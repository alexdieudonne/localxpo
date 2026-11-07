// Node Imports
import fs from 'node:fs'
import path from 'node:path'

// Third-party Imports
import type { PGlite } from '@electric-sql/pglite'
import type { Pool, PoolClient } from 'pg'

import { migrate, MIGRATIONS } from './migrations'

const LATEST_MIGRATION = Math.max(...MIGRATIONS.map(m => m.version))

/**
 * Postgres everywhere, two drivers:
 *  - DATABASE_URL set (localxpo Cloud, e.g. Neon): node-postgres pool.
 *  - otherwise (self-hosted, zero setup): PGlite, an embedded Postgres stored in data/pglite.
 * Queries use `?` placeholders (converted to $1, $2…), and every call is async.
 */

export const dataDir = () =>
  path.resolve(
    /*turbopackIgnore: true*/ process.env.LOCALXPO_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), 'data')
  )

export type Params = unknown[]
export type RunResult = { changes: number }

export type Queryable = {
  one: <T = Record<string, unknown>>(sql: string, ...params: Params) => Promise<T | undefined>
  all: <T = Record<string, unknown>>(sql: string, ...params: Params) => Promise<T[]>
  run: (sql: string, ...params: Params) => Promise<RunResult>
}

export type Db = Queryable & {

  /** Several statements, no parameters (schema). */
  exec: (sql: string) => Promise<void>

  /** Runs fn in a transaction: committed if it resolves, rolled back if it throws. */
  tx: <T>(fn: (t: Queryable) => Promise<T>) => Promise<T>
  driver: 'pg' | 'pglite'
}

/** `?` → `$n`, skipping quoted strings and dollar-quoted bodies. */
export const toPositional = (sql: string) => {
  let out = ''
  let n = 0
  let i = 0

  while (i < sql.length) {
    const c = sql[i]

    if (c === "'") {
      const end = sql.indexOf("'", i + 1)
      const stop = end < 0 ? sql.length : end + 1

      out += sql.slice(i, stop)
      i = stop
    } else if (c === '$' && sql[i + 1] === '$') {
      const end = sql.indexOf('$$', i + 2)
      const stop = end < 0 ? sql.length : end + 2

      out += sql.slice(i, stop)
      i = stop
    } else if (c === '?') {
      out += `$${++n}`
      i++
    } else {
      out += c
      i++
    }
  }

  return out
}

// Postgres returns 64-bit integers and NUMERIC as strings: timestamps (ms), COUNT(*) and SUM() become numbers.
const INT8 = 20
const NUMERIC = 1700
const toNumber = (v: string) => (v === null ? v : Number(v))

type Raw = { query: (sql: string, params: Params) => Promise<{ rows: Record<string, unknown>[]; changes: number }> }

const wrap = (raw: Raw): Queryable => ({
  one: async <T>(sql: string, ...params: Params) => (await raw.query(toPositional(sql), params)).rows[0] as T | undefined,
  all: async <T>(sql: string, ...params: Params) => (await raw.query(toPositional(sql), params)).rows as T[],
  run: async (sql: string, ...params: Params) => ({ changes: (await raw.query(toPositional(sql), params)).changes })
})

const pgDriver = async (url: string): Promise<Db> => {
  const pg = await import('pg')

  pg.default.types.setTypeParser(INT8, toNumber)
  pg.default.types.setTypeParser(NUMERIC, toNumber)

  const pool: Pool = new pg.default.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) })

  const rawOf = (c: Pool | PoolClient): Raw => ({
    query: async (sql, params) => {
      const r = await c.query(sql, params as unknown[])

      return { rows: r.rows, changes: r.rowCount ?? 0 }
    }
  })

  return {
    ...wrap(rawOf(pool)),
    driver: 'pg',
    exec: async sql => {
      await pool.query(sql)
    },
    tx: async fn => {
      const client = await pool.connect()

      try {
        await client.query('BEGIN')
        const result = await fn(wrap(rawOf(client)))

        await client.query('COMMIT')

        return result
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    }
  }
}

const pgliteDriver = async (dir: string): Promise<Db> => {
  const { PGlite } = await import('@electric-sql/pglite')

  fs.mkdirSync(dir, { recursive: true })

  const lite: PGlite = new PGlite(dir, { parsers: { [INT8]: toNumber, [NUMERIC]: toNumber } })

  await lite.waitReady

  type Tx = { query: PGlite['query'] }

  const rawOf = (c: Tx): Raw => ({
    query: async (sql, params) => {
      const r = await c.query<Record<string, unknown>>(sql, params as unknown[])

      return { rows: r.rows, changes: r.affectedRows ?? 0 }
    }
  })

  return {
    ...wrap(rawOf(lite)),
    driver: 'pglite',
    exec: async sql => {
      await lite.exec(sql)
    },
    tx: fn => lite.transaction(tx => fn(wrap(rawOf(tx as unknown as Tx))))
  }
}

// Cached on globalThis so `next dev` hot reloads keep one pool / one embedded database. The key is new on
// purpose: the SQLite version cached its connection under `__localxpoDb`, and a dev server that hot-reloads
// from that version would otherwise pick up the old SQLite handle ("….one is not a function").
const g = globalThis as unknown as { __localxpoPg?: Promise<Db>; __localxpoPgVersion?: number }

const connect = async (): Promise<Db> => {
  const db = process.env.DATABASE_URL ? await pgDriver(process.env.DATABASE_URL) : await pgliteDriver(path.join(/*turbopackIgnore: true*/ dataDir(), 'pglite'))
  const { importSqliteIfNeeded } = await import('./sqlite-import')

  await migrate(db)

  // Upgrading from localxpo before Postgres: bring data/localxpo.db over once.
  if (process.env.LOCALXPO_SKIP_SQLITE_IMPORT !== '1') await importSqliteIfNeeded(db, dataDir())

  return db
}

export const getDb = (): Promise<Db> => {
  if (!(g.__localxpoPg instanceof Promise)) {
    g.__localxpoPg = connect()
    g.__localxpoPgVersion = LATEST_MIGRATION

    // A failed start (bad URL, …) is retried on the next request instead of being cached forever.
    g.__localxpoPg.catch(() => (g.__localxpoPg = undefined))
  }

  // `next dev` keeps the connection across hot reloads: apply migrations that arrived since it was opened.
  if ((g.__localxpoPgVersion ?? 0) < LATEST_MIGRATION) {
    g.__localxpoPgVersion = LATEST_MIGRATION
    g.__localxpoPg = g.__localxpoPg.then(async db => {
      await migrate(db)

      return db
    })
    g.__localxpoPg.catch(() => (g.__localxpoPg = undefined))
  }

  return g.__localxpoPg
}

/** Shorthand used by every module: `await db.one(...)`, `await db.tx(async t => …)`. */
export const db: Db = {
  driver: process.env.DATABASE_URL ? 'pg' : 'pglite',
  one: async (sql, ...params) => (await getDb()).one(sql, ...params),
  all: async (sql, ...params) => (await getDb()).all(sql, ...params),
  run: async (sql, ...params) => (await getDb()).run(sql, ...params),
  exec: async sql => (await getDb()).exec(sql),
  tx: async fn => (await getDb()).tx(fn)
}
