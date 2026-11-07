/**
 * Copies an old localxpo SQLite database into the Postgres database in DATABASE_URL (e.g. Neon), for moving a
 * self-hosted dashboard to the cloud:  DATABASE_URL=postgres://… LOCALXPO_SKIP_SQLITE_IMPORT=1 pnpm db:import data/localxpo.db
 * Copy data/.secret to the new server too (LOCALXPO_SECRET), or stored credentials can't be decrypted.
 */
import { db } from '../src/lib/server/db'
import { importSqlite } from '../src/lib/server/sqlite-import'

const file = process.argv[2]

if (!file) {
  console.error('Usage: pnpm db:import <path/to/localxpo.db>')
  process.exit(1)
}

importSqlite(db, file, m => console.log(m))
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
