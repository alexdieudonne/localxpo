import { newId } from './crypto'
import { db } from './db'
import { detectIssues, type BuildIssue, type LogLineInput } from './issues'

export const BUILD_STATUSES = ['queued', 'in_progress', 'success', 'failed', 'canceled'] as const
export const STEP_STATUSES = ['pending', 'in_progress', 'success', 'failed', 'skipped'] as const

export type BuildStatus = (typeof BUILD_STATUSES)[number]
export type StepStatus = (typeof STEP_STATUSES)[number]
export type Platform = 'ios' | 'android'

export type Build = {
  id: string
  number: number
  org_id: string
  project_id: string
  user_id: string
  platform: Platform
  profile: string
  status: BuildStatus
  runner: string
  machine: string | null
  git_commit: string | null
  git_branch: string | null
  git_dirty: number
  app_version: string | null
  build_number: string | null
  cli_version: string | null
  dev_client: number
  distribution: string | null
  fingerprint: string | null
  artifact_path: string | null
  submitted: number
  error_message: string | null
  issues_json: string
  log_lines: number
  metrics_json: string | null
  cancel_requested_at: number | null
  created_at: number
  started_at: number | null
  finished_at: number | null

  /** Last request from the CLI running it; set when it was marked failed for going silent. */
  last_contact_at: number | null
  lost_at: number | null
}

export type BuildRow = Build & { project_name: string; project_slug: string; org_slug: string; started_by: string | null }

export type BuildStep = {
  key: string
  name: string
  position: number
  status: StepStatus
  started_at: number | null
  finished_at: number | null
}

export type LogLine = { seq: number; ts: number; step: string; stream: string; line: string }

export const isFinished = (status: string) => status === 'success' || status === 'failed' || status === 'canceled'

/** A build left "in progress" with no log activity for this long is shown as stale (machine went away). */
export const STALE_AFTER_MS = 30 * 60 * 1000

/** Canonical dashboard URL of a build. */
export const buildPath = (b: Pick<BuildRow, 'org_slug' | 'project_slug' | 'id'>) => `/${b.org_slug}/projects/${b.project_slug}/builds/${b.id}`

// ---------- Queries ----------

const BUILD_SELECT = `SELECT b.*, p.name AS project_name, p.slug AS project_slug, o.slug AS org_slug, u.name AS started_by
  FROM builds b
  JOIN projects p ON p.id = b.project_id
  JOIN organizations o ON o.id = b.org_id
  LEFT JOIN users u ON u.id = b.user_id`

export type BuildFilters = {
  projectId?: string
  platform?: string
  status?: string
  devClient?: boolean
  fingerprint?: string
  limit?: number
  offset?: number
}

export const listBuilds = async (orgId: string, f: BuildFilters = {}) => {
  const where = ['b.org_id = ?']
  const args: unknown[] = [orgId]

  if (f.projectId) {
    where.push('b.project_id = ?')
    args.push(f.projectId)
  }

  if (f.platform === 'ios' || f.platform === 'android') {
    where.push('b.platform = ?')
    args.push(f.platform)
  }

  if (f.status && (BUILD_STATUSES as readonly string[]).includes(f.status)) {
    where.push('b.status = ?')
    args.push(f.status)
  }

  if (f.devClient !== undefined) {
    where.push('b.dev_client = ?')
    args.push(f.devClient ? 1 : 0)
  }

  if (f.fingerprint) {
    where.push('b.fingerprint = ?')
    args.push(f.fingerprint)
  }

  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200)
  const offset = Math.max(f.offset ?? 0, 0)

  const rows = ((await db.all(`${BUILD_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`, ...args, limit, offset)) as BuildRow[])

  const { total } = (await db.one(`SELECT COUNT(*) AS total FROM builds b WHERE ${where.join(' AND ')}`, ...args)) as { total: number }

  return { rows, total }
}

export const getBuild = async (orgId: string, id: string) =>
  ((await db.one(`${BUILD_SELECT} WHERE b.id = ? AND b.org_id = ?`, id, orgId)) as BuildRow | undefined)

/** Build by id if the user is a member of its org (API routes, legacy /builds/:id links). */
export const getBuildForUser = async (userId: string, id: string) =>
  ((await db.one(`${BUILD_SELECT} JOIN memberships m ON m.org_id = b.org_id AND m.user_id = ? WHERE b.id = ?`, userId, id)) as BuildRow | undefined)

export const getSteps = async (buildId: string) =>
  ((await db.all('SELECT * FROM build_steps WHERE build_id = ? ORDER BY position', buildId)) as BuildStep[])

export const getIssues = (build: Pick<Build, 'issues_json'>): BuildIssue[] => {
  try {
    return JSON.parse(build.issues_json) as BuildIssue[]
  } catch {
    return []
  }
}

export const getLogs = async (buildId: string, opts: { after?: number; limit?: number; step?: string } = {}) => {
  const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 10000)
  const args: unknown[] = [buildId, opts.after ?? -1]
  let sql = 'SELECT seq, ts, step, stream, line FROM build_logs WHERE build_id = ? AND seq > ?'

  if (opts.step) {
    sql += ' AND step = ?'
    args.push(opts.step)
  }

  sql += ' ORDER BY seq LIMIT ?'
  args.push(limit)

  return ((await db.all(sql, ...args)) as LogLine[])
}

// ---------- Mutations ----------

export type CreateBuildInput = {
  projectId: string
  platform: Platform
  profile: string
  machine?: string | null
  gitCommit?: string | null
  gitBranch?: string | null
  gitDirty?: boolean
  appVersion?: string | null
  buildNumber?: string | null
  cliVersion?: string | null
  runner?: string
  devClient?: boolean
  distribution?: string | null
  fingerprint?: string | null
}

export const createBuild = async (orgId: string, userId: string, input: CreateBuildInput): Promise<BuildRow> => {
  const id = newId()
  const now = Date.now()

  await db.tx(async t => {
    // Lock the project row: two builds starting at once still get different numbers.
    await t.run('SELECT id FROM projects WHERE id = ? FOR UPDATE', input.projectId)
    const { next } = (await t.one('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM builds WHERE project_id = ?', input.projectId)) as { next: number }

    await t.run(`INSERT INTO builds (id, number, org_id, project_id, user_id, platform, profile, status, runner, machine, git_commit,
        git_branch, git_dirty, app_version, build_number, cli_version, dev_client, distribution, fingerprint, created_at, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
      next,
      orgId,
      input.projectId,
      userId,
      input.platform,
      input.profile,
      input.runner ?? 'local',
      input.machine ?? null,
      input.gitCommit ?? null,
      input.gitBranch ?? null,
      input.gitDirty ? 1 : 0,
      input.appVersion ?? null,
      input.buildNumber ?? null,
      input.cliVersion ?? null,
      input.devClient ? 1 : 0,
      input.distribution ?? null,
      input.fingerprint ?? null,
      now,
      now)
  })

  return (await getBuild(orgId, id))!
}

export type UpdateBuildInput = {
  status?: BuildStatus
  errorMessage?: string | null
  artifactPath?: string | null
  submitted?: boolean
  appVersion?: string | null
  buildNumber?: string | null
  finishedAt?: number
  fingerprint?: string | null
}

export const updateBuild = async (build: BuildRow, input: UpdateBuildInput) => {
  const status = input.status ?? build.status

  const reported =
    input.finishedAt && input.finishedAt <= Date.now() && input.finishedAt >= (build.started_at ?? 0) ? input.finishedAt : null

  const finishedAt = isFinished(status) ? (build.finished_at ?? reported ?? Date.now()) : null

  await db.run(`UPDATE builds SET status = ?, error_message = COALESCE(?, error_message), artifact_path = COALESCE(?, artifact_path),
        submitted = COALESCE(?, submitted), app_version = COALESCE(?, app_version), build_number = COALESCE(?, build_number),
        fingerprint = COALESCE(?, fingerprint), finished_at = ? WHERE id = ?`, status,
      input.errorMessage ?? null,
      input.artifactPath ?? null,
      input.submitted === undefined ? null : input.submitted ? 1 : 0,
      input.appVersion ?? null,
      input.buildNumber ?? null,
      input.fingerprint ?? null,
      finishedAt,
      build.id)

  // Any step still running when the build ends inherits the final outcome.
  if (isFinished(status)) {
    await db.run(`UPDATE build_steps SET status = ?, finished_at = COALESCE(finished_at, ?) WHERE build_id = ? AND status = 'in_progress'`, status === 'success' ? 'success' : 'failed', Date.now(), build.id)
  }

  return getBuild(build.org_id, build.id)
}

export const upsertStep = async (
  buildId: string,
  step: { key: string; name: string; position: number; status: StepStatus }
) => {
  const now = Date.now()

  const started = step.status !== 'pending' ? now : null
  const finished = ['success', 'failed', 'skipped'].includes(step.status) ? now : null

  await db.run(
    `INSERT INTO build_steps (build_id, key, name, position, status, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (build_id, key) DO UPDATE SET
         name = excluded.name, position = excluded.position, status = excluded.status,
         started_at = COALESCE(build_steps.started_at, excluded.started_at),
         finished_at = excluded.finished_at`,
    buildId,
    step.key,
    step.name,
    step.position,
    step.status,
    started,
    finished
  )
}

/** Idempotent: re-sending the same seq is ignored, so the CLI can safely retry. */
export const appendLogs = async (build: Build, lines: (LogLineInput & { ts?: number })[]) => {

  await db.tx(async t => {
    let inserted = 0

    for (const l of lines) {
      inserted += (
        await t.run(
          'INSERT INTO build_logs (build_id, seq, ts, step, stream, line) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (build_id, seq) DO NOTHING',
          build.id,
          l.seq,
          l.ts ?? Date.now(),
          l.step,
          l.stream,
          l.line
        )
      ).changes
    }

    // Re-read inside the transaction (row locked) so concurrent batches don't overwrite each other's issues.
    const current = (await t.one<{ issues_json: string }>('SELECT issues_json FROM builds WHERE id = ? FOR UPDATE', build.id))!
    const issues = detectIssues(lines, getIssues(current))

    await t.run('UPDATE builds SET log_lines = log_lines + ?, issues_json = ? WHERE id = ?', inserted, JSON.stringify(issues), build.id)
  })
}

export const deleteBuild = async (orgId: string, id: string) =>
  await db.run('DELETE FROM builds WHERE id = ? AND org_id = ?', id, orgId)

// ---------- Stats (org dashboard, project insights) ----------

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type DayBucket = { date: string; success: number; failed: number; other: number }

export const getBuildStats = async (scope: { orgId: string; projectId?: string }, days = 14) => {
  const where = scope.projectId ? 'org_id = ? AND project_id = ?' : 'org_id = ?'
  const args = scope.projectId ? [scope.orgId, scope.projectId] : [scope.orgId]
  const since = new Date()

  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))

  const totals = (await db.one(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'success') AS success,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS running,
        AVG(CASE WHEN status = 'success' THEN finished_at - started_at END) AS avg_ms
       FROM builds WHERE ${where} AND created_at >= ?`, ...args, since.getTime())) as { total: number; success: number; failed: number; running: number; avg_ms: number | null }

  const rows = (await db.all(`SELECT created_at, status FROM builds WHERE ${where} AND created_at >= ? ORDER BY created_at`, ...args, since.getTime())) as { created_at: number; status: string }[]

  const buckets: DayBucket[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(since)

    d.setDate(d.getDate() + i)
    buckets.push({ date: localDay(d), success: 0, failed: 0, other: 0 })
  }

  for (const r of rows) {
    const day = buckets.find(b => b.date === localDay(new Date(r.created_at)))

    if (!day) continue
    if (r.status === 'success') day.success++
    else if (r.status === 'failed') day.failed++
    else day.other++
  }

  return {
    total: totals.total ?? 0,
    success: totals.success ?? 0,
    failed: totals.failed ?? 0,
    running: totals.running ?? 0,
    avgMs: totals.avg_ms,
    days: buckets
  }
}

/** Per-platform numbers + the most frequent failure causes, for the Insights page. */
export const getProjectInsights = async (projectId: string, sinceDays = 30) => {
  const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000

  const perPlatform = (await db.all(`SELECT platform, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'success') AS success, COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        AVG(CASE WHEN status = 'success' THEN finished_at - started_at END) AS avg_ms,
        MIN(CASE WHEN status = 'success' THEN finished_at - started_at END) AS min_ms,
        MAX(CASE WHEN status = 'success' THEN finished_at - started_at END) AS max_ms
       FROM builds WHERE project_id = ? AND created_at >= ? GROUP BY platform`, projectId, since)) as {
    platform: Platform
    total: number
    success: number
    failed: number
    avg_ms: number | null
    min_ms: number | null
    max_ms: number | null
  }[]

  const durations = (await db.all(`SELECT number, platform, finished_at - started_at AS ms, created_at FROM builds
       WHERE project_id = ? AND status = 'success' AND created_at >= ? ORDER BY created_at`, projectId, since)) as { number: number; platform: Platform; ms: number; created_at: number }[]

  const failedIssues = (await db.all(`SELECT issues_json FROM builds WHERE project_id = ? AND status = 'failed' AND created_at >= ?`, projectId, since)) as { issues_json: string }[]

  const causes = new Map<string, { title: string; fix: string; count: number }>()

  for (const r of failedIssues) {
    for (const i of getIssues(r)) {
      const c = causes.get(i.id) ?? { title: i.title, fix: i.fix, count: 0 }

      c.count++
      causes.set(i.id, c)
    }
  }

  const steps = (await db.all(`SELECT s.name, COUNT(*) AS failures FROM build_steps s JOIN builds b ON b.id = s.build_id
       WHERE b.project_id = ? AND b.created_at >= ? AND s.status = 'failed' GROUP BY s.name ORDER BY failures DESC`, projectId, since)) as { name: string; failures: number }[]

  const machines = (await db.all(`SELECT COALESCE(machine, 'unknown') AS machine, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'success') AS success
       FROM builds WHERE project_id = ? AND created_at >= ? GROUP BY machine ORDER BY total DESC LIMIT 8`, projectId, since)) as { machine: string; total: number; success: number }[]

  return {
    perPlatform,
    durations,
    topCauses: [...causes.entries()].map(([id, c]) => ({ id, ...c })).sort((a, b) => b.count - a.count).slice(0, 6),
    failingSteps: steps,
    machines
  }
}

// ---------- Fingerprints ----------

export type FingerprintRow = {
  fingerprint: string
  platform: Platform
  builds: number
  successful: number
  first_seen: number
  last_seen: number
  latest_build_id: string
  latest_success_id: string | null
  app_version: string | null
}

export const listFingerprints = async (projectId: string) =>
  ((await db.all(`SELECT fingerprint, platform, COUNT(*) AS builds, COUNT(*) FILTER (WHERE status = 'success') AS successful,
        MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
        (SELECT id FROM builds x WHERE x.project_id = b.project_id AND x.fingerprint = b.fingerprint AND x.platform = b.platform
          ORDER BY created_at DESC LIMIT 1) AS latest_build_id,
        (SELECT id FROM builds x WHERE x.project_id = b.project_id AND x.fingerprint = b.fingerprint AND x.platform = b.platform
          AND x.status = 'success' ORDER BY created_at DESC LIMIT 1) AS latest_success_id,
        (SELECT app_version FROM builds x WHERE x.project_id = b.project_id AND x.fingerprint = b.fingerprint
          ORDER BY created_at DESC LIMIT 1) AS app_version
       FROM builds b WHERE project_id = ? AND fingerprint IS NOT NULL
       GROUP BY b.project_id, fingerprint, platform ORDER BY last_seen DESC`, projectId)) as FingerprintRow[])

/** Latest successful build with the same native fingerprint (the CLI uses this to say "no rebuild needed"). */
export const findCompatibleBuild = async (projectId: string, platform: string, fingerprint: string, profile: string) =>
  ((await db.one(`${BUILD_SELECT} WHERE b.project_id = ? AND b.platform = ? AND b.fingerprint = ? AND b.profile = ? AND b.status = 'success'
       ORDER BY b.created_at DESC LIMIT 1`, projectId, platform, fingerprint, profile)) as BuildRow | undefined)
