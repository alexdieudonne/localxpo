// Node Imports
import fs from 'node:fs'
import path from 'node:path'

import type { Db } from './db'

/**
 * One-time move from the old SQLite file (data/localxpo.db, localxpo before Postgres) into Postgres.
 * Runs automatically when the Postgres database has no users yet and the SQLite file exists; the file is
 * kept (renamed *.imported) so nothing is lost. Secrets stay encrypted with the same data/.secret key.
 */

// Parents before children (foreign keys).
const TABLES = [
  'users',
  'sessions',
  'api_tokens',
  'organizations',
  'memberships',
  'projects',
  'builds',
  'build_steps',
  'build_logs',
  'credentials',
  'env_vars',
  'submissions',
  'submission_logs',
  'machines',
  'agents',
  'jobs',
  'build_limits',
  'run_samples'
]

const BATCH = 500

export const importSqlite = async (db: Db, file: string, log: (m: string) => void = () => {}) => {
  const { default: Database } = await import('better-sqlite3')
  const src = new Database(/*turbopackIgnore: true*/ file, { readonly: true, fileMustExist: true })
  const counts: Record<string, number> = {}

  try {
    const have = new Set((src.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(r => r.name))

    await db.tx(async t => {
      for (const table of TABLES) {
        if (!have.has(table)) continue

        const target = new Set((await t.all<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = ?', table)).map(c => c.column_name))
        const cols = (src.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name).filter(c => target.has(c))
        const rows = src.prepare(`SELECT ${cols.join(', ')} FROM ${table}`).all() as Record<string, unknown>[]

        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH)
          const values = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')

          await t.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values} ON CONFLICT DO NOTHING`, ...chunk.flatMap(r => cols.map(c => r[c] ?? null)))
        }

        counts[table] = rows.length
      }
    })
  } finally {
    src.close()
  }

  log(`Imported from ${path.basename(file)}: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ')}`)

  return counts
}

/** On startup: import data/localxpo.db once if Postgres is still empty. */
export const importSqliteIfNeeded = async (db: Db, dataDir: string) => {
  const file = process.env.LOCALXPO_SQLITE_FILE ?? path.join(/*turbopackIgnore: true*/ dataDir, 'localxpo.db')

  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return

  const users = await db.one<{ n: number }>('SELECT COUNT(*) AS n FROM users')

  if (users && users.n > 0) return

  console.log(`[localxpo] Moving your data from ${file} to Postgres…`)
  await importSqlite(db, file, m => console.log(`[localxpo] ${m}`))

  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(/*turbopackIgnore: true*/ f)) fs.renameSync(/*turbopackIgnore: true*/ f, `${f}.imported`)
  console.log(`[localxpo] Done. The SQLite file was kept as ${path.basename(file)}.imported.`)
}
