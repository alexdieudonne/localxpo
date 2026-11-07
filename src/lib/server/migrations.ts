import type { Db } from './db'

/**
 * Postgres schema, as numbered migrations applied once each (table schema_migrations).
 * Timestamps are milliseconds since the epoch (BIGINT); JSON is stored as text, like before.
 * Add a change: append { version: n + 1, sql } — never edit a migration that has shipped.
 */
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial schema (matches the SQLite schema v7)',
    sql: /* sql */ `
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    BIGINT NOT NULL
);
CREATE UNIQUE INDEX users_email_ci ON users (lower(email));

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE api_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  prefix       TEXT NOT NULL,
  last_used_at BIGINT,
  created_at   BIGINT NOT NULL
);

CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX organizations_slug_ci ON organizations (lower(slug));

CREATE TABLE memberships (
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user ON memberships(user_id);

CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  ios_bundle_id   TEXT,
  android_package TEXT,
  app_version     TEXT,
  sdk_version     TEXT,
  config_json     TEXT,
  eas_json        TEXT,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);
CREATE UNIQUE INDEX projects_org_slug ON projects(org_id, slug);

CREATE TABLE builds (
  id                  TEXT PRIMARY KEY,
  number              INTEGER NOT NULL,
  org_id              TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  profile             TEXT NOT NULL,
  status              TEXT NOT NULL,
  runner              TEXT NOT NULL DEFAULT 'local',
  machine             TEXT,
  git_commit          TEXT,
  git_branch          TEXT,
  git_dirty           INTEGER NOT NULL DEFAULT 0,
  app_version         TEXT,
  build_number        TEXT,
  cli_version         TEXT,
  dev_client          INTEGER NOT NULL DEFAULT 0,
  distribution        TEXT,
  fingerprint         TEXT,
  artifact_path       TEXT,
  submitted           INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  issues_json         TEXT NOT NULL DEFAULT '[]',
  log_lines           INTEGER NOT NULL DEFAULT 0,
  metrics_json        TEXT,
  cancel_requested_at BIGINT,
  created_at          BIGINT NOT NULL,
  started_at          BIGINT,
  finished_at         BIGINT
);
CREATE INDEX builds_org_created ON builds(org_id, created_at DESC);
CREATE INDEX builds_project_created ON builds(project_id, created_at DESC);
CREATE INDEX builds_fingerprint ON builds(project_id, fingerprint);

CREATE TABLE build_steps (
  build_id    TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  status      TEXT NOT NULL,
  started_at  BIGINT,
  finished_at BIGINT,
  PRIMARY KEY (build_id, key)
);

CREATE TABLE build_logs (
  build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL,
  ts       BIGINT NOT NULL,
  step     TEXT NOT NULL,
  stream   TEXT NOT NULL,
  line     TEXT NOT NULL,
  PRIMARY KEY (build_id, seq)
);

CREATE TABLE credentials (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  label      TEXT NOT NULL,
  meta_json  TEXT NOT NULL DEFAULT '{}',
  secret_enc TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX credentials_org_kind ON credentials(org_id, kind);

CREATE TABLE env_vars (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  environment TEXT NOT NULL,
  value_enc   TEXT NOT NULL,
  secret      INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL,
  UNIQUE (project_id, name, environment)
);

CREATE TABLE submissions (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_id            TEXT REFERENCES builds(id) ON DELETE SET NULL,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  destination         TEXT NOT NULL,
  status              TEXT NOT NULL,
  app_version         TEXT,
  build_number        TEXT,
  artifact_name       TEXT,
  machine             TEXT,
  error_message       TEXT,
  issues_json         TEXT NOT NULL DEFAULT '[]',
  log_lines           INTEGER NOT NULL DEFAULT 0,
  metrics_json        TEXT,
  cancel_requested_at BIGINT,
  created_at          BIGINT NOT NULL,
  finished_at         BIGINT
);
CREATE INDEX submissions_project ON submissions(project_id, created_at DESC);

CREATE TABLE submission_logs (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  ts            BIGINT NOT NULL,
  step          TEXT NOT NULL,
  stream        TEXT NOT NULL,
  line          TEXT NOT NULL,
  PRIMARY KEY (submission_id, seq)
);

CREATE TABLE machines (
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  info_json  TEXT NOT NULL DEFAULT '{}',
  first_seen BIGINT NOT NULL,
  last_seen  BIGINT NOT NULL,
  PRIMARY KEY (org_id, name)
);

CREATE TABLE agents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine       TEXT NOT NULL,
  version       TEXT,
  platforms     TEXT NOT NULL DEFAULT '[]',
  projects_json TEXT NOT NULL DEFAULT '[]',
  busy_job_id   TEXT,
  started_at    BIGINT NOT NULL,
  last_seen     BIGINT NOT NULL,
  UNIQUE (user_id, machine)
);

CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine      TEXT NOT NULL,
  kind         TEXT NOT NULL,
  params_json  TEXT NOT NULL,
  status       TEXT NOT NULL,
  after_job_id TEXT,
  run_kind     TEXT,
  run_id       TEXT,
  error        TEXT,
  created_at   BIGINT NOT NULL,
  claimed_at   BIGINT,
  finished_at  BIGINT
);
CREATE INDEX jobs_machine_status ON jobs(machine, status, created_at);
CREATE INDEX jobs_project ON jobs(project_id, created_at DESC);

CREATE TABLE build_limits (
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  machine     TEXT NOT NULL,
  limits_json TEXT NOT NULL,
  updated_at  BIGINT NOT NULL,
  PRIMARY KEY (org_id, machine)
);

CREATE TABLE run_samples (
  run_kind  TEXT NOT NULL,
  run_id    TEXT NOT NULL,
  ts        BIGINT NOT NULL,
  step      TEXT,
  data_json TEXT NOT NULL,
  PRIMARY KEY (run_kind, run_id, ts)
);

-- Samples belong to a build or a submission (no foreign key: two parent tables).
CREATE FUNCTION lx_cleanup_samples() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM run_samples WHERE run_kind = TG_ARGV[0] AND run_id = OLD.id;
  RETURN OLD;
END
$$;
CREATE TRIGGER builds_samples_cleanup AFTER DELETE ON builds FOR EACH ROW EXECUTE FUNCTION lx_cleanup_samples('builds');
CREATE TRIGGER submissions_samples_cleanup AFTER DELETE ON submissions FOR EACH ROW EXECUTE FUNCTION lx_cleanup_samples('submissions');
`
  },
  {
    version: 2,
    name: 'billing (localxpo Cloud)',
    sql: /* sql */ `
-- One row per organization that ever opened billing. No row = Free.
CREATE TABLE org_billing (
  org_id                 TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'free',
  billing_interval       TEXT,
  status                 TEXT NOT NULL DEFAULT 'none',
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end     BIGINT,
  trial_end              BIGINT,
  cancel_at              BIGINT,
  past_due_since         BIGINT,
  trial_used             BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at             BIGINT NOT NULL
);

-- Webhook deliveries already handled (Stripe retries and may send an event twice).
CREATE TABLE stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  processed_at BIGINT NOT NULL
);
`
  },
  {
    version: 3,
    name: 'run liveness (fail builds whose machine stopped responding)',
    sql: /* sql */ `
-- Last request from the CLI running this build / submission (logs, steps, metrics, control poll).
ALTER TABLE builds ADD COLUMN last_contact_at BIGINT;
ALTER TABLE builds ADD COLUMN lost_at BIGINT;
ALTER TABLE submissions ADD COLUMN last_contact_at BIGINT;
ALTER TABLE submissions ADD COLUMN lost_at BIGINT;
UPDATE builds SET last_contact_at = COALESCE(finished_at, started_at, created_at);
UPDATE submissions SET last_contact_at = COALESCE(finished_at, created_at);
`
  },
  {
    version: 4,
    name: 'failed sign-in attempts (rate limiting)',
    sql: /* sql */ `
CREATE TABLE login_attempts (
  key TEXT NOT NULL,
  at  BIGINT NOT NULL
);
CREATE INDEX login_attempts_key_at ON login_attempts (key, at);
`
  }
]

/** Applies pending migrations in order, each in its own transaction. Safe to run on every start. */
export const migrate = async (db: Db) => {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)')

  const done = new Set((await db.all<{ version: number }>('SELECT version FROM schema_migrations')).map(r => r.version))

  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue

    await db.tx(async t => {
      // Multi-statement DDL goes through the transaction's connection one statement at a time.
      for (const statement of splitSql(m.sql)) await t.run(statement)
      await t.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', m.version, m.name, Date.now())
    })
  }
}

/** Splits a script on `;` at the end of statements, keeping $$ bodies (and their semicolons) intact. */
export const splitSql = (sql: string) => {
  const out: string[] = []
  let current = ''
  let inDollar = false

  for (const line of sql.split('\n')) {
    const trimmed = line.trim()

    if (!inDollar && (trimmed.startsWith('--') || trimmed === '')) continue
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) inDollar = !inDollar
    current += `${line}\n`

    if (!inDollar && trimmed.endsWith(';')) {
      out.push(current.trim().replace(/;$/, ''))
      current = ''
    }
  }

  if (current.trim()) out.push(current.trim())

  return out
}
