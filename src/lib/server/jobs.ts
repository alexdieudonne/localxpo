import { newId } from './crypto'
import { db } from './db'

/**
 * Dashboard → machine. A job is queued for one machine; the agent running there (`npx localxpo agent`)
 * claims it on its next check-in and starts the CLI, which then reports the build / submission as usual.
 */

export type JobKind = 'build' | 'submit'
export type JobStatus = 'waiting' | 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'canceled' | 'dismissed'

export type BuildJobParams = {
  platform: 'ios' | 'android'
  profile: string

  /** Legacy: upload inside the build process. New jobs queue a separate upload job instead (thenSubmit). */
  submit?: boolean
  thenSubmit?: boolean
  clean?: boolean
}
export type SubmitJobParams = { buildId: string; profile?: string }

export type Job = {
  id: string
  org_id: string
  project_id: string
  user_id: string
  machine: string
  kind: JobKind
  params: BuildJobParams | SubmitJobParams
  status: JobStatus
  run_kind: 'builds' | 'submissions' | null
  run_id: string | null
  error: string | null
  created_at: number
  claimed_at: number | null
  finished_at: number | null
  after_job_id: string | null
}

type JobRow = Omit<Job, 'params'> & { params_json: string }

const toJob = (r: JobRow): Job => {
  const { params_json, ...rest } = r

  return { ...rest, params: JSON.parse(params_json) }
}

/** An agent that checked in within this window is online. */
export const AGENT_ONLINE_MS = 20_000

/** A claimed job the agent never started (agent killed) goes back to the queue after this. */
const CLAIM_TIMEOUT_MS = 90_000

// ---------- Agents ----------

export type AgentProject = { projectId: string; name?: string; dir?: string }

export type Agent = {
  id: string
  user_id: string
  machine: string
  version: string | null
  platforms: ('ios' | 'android')[]
  projects: AgentProject[]
  busy_job_id: string | null
  started_at: number
  last_seen: number
  online: boolean
}

type AgentRow = Omit<Agent, 'platforms' | 'projects' | 'online'> & { platforms: string; projects_json: string }

const toAgent = (r: AgentRow): Agent => ({
  id: r.id,
  user_id: r.user_id,
  machine: r.machine,
  version: r.version,
  platforms: JSON.parse(r.platforms),
  projects: JSON.parse(r.projects_json),
  busy_job_id: r.busy_job_id,
  started_at: r.started_at,
  last_seen: r.last_seen,
  online: Date.now() - r.last_seen < AGENT_ONLINE_MS
})

/** Agents that can build at least one project of this organization. */
export const listAgentsForOrg = async (orgId: string): Promise<Agent[]> => {
  const projectIds = new Set(
    ((await db.all('SELECT id FROM projects WHERE org_id = ?', orgId)) as { id: string }[]).map(p => p.id)
  )

  return (((await db.all('SELECT a.* FROM agents a JOIN memberships m ON m.user_id = a.user_id AND m.org_id = ? ORDER BY a.last_seen DESC', orgId)) as AgentRow[]))
    .map(toAgent)
    .filter(a => a.projects.some(p => projectIds.has(p.projectId)))
}

export const agentsForProject = async (orgId: string, projectId: string) => (await listAgentsForOrg(orgId)).filter(a => a.projects.some(p => p.projectId === projectId))

/**
 * Agent check-in: records what the machine can build, and hands it the oldest job queued for it (one at a
 * time: a busy agent gets nothing new). Only projects the agent's user can access are kept.
 */
export const agentHeartbeat = async (
  userId: string,
  input: { machine: string; version?: string; platforms: ('ios' | 'android')[]; projects: AgentProject[]; busyJobId?: string | null }
): Promise<Job | null> => {
  const now = Date.now()

  const ids0 = input.projects.map(p => p.projectId)

  const accessible = ids0.length
    ? new Set(
        (
          await db.all<{ id: string }>(
            `SELECT pr.id FROM projects pr JOIN memberships m ON m.org_id = pr.org_id AND m.user_id = ? WHERE pr.id IN (${ids0.map(() => '?').join(',')})`,
            userId,
            ...ids0
          )
        ).map(r => r.id)
      )
    : new Set<string>()

  const allowed = input.projects.filter(p => accessible.has(p.projectId))

  return db.tx(async t => {
    const existing = (await t.one('SELECT id FROM agents WHERE user_id = ? AND machine = ?', userId, input.machine)) as { id: string } | undefined

    if (existing)
      await t.run('UPDATE agents SET version = ?, platforms = ?, projects_json = ?, busy_job_id = ?, last_seen = ? WHERE id = ?', input.version ?? null,
        JSON.stringify(input.platforms),
        JSON.stringify(allowed),
        input.busyJobId ?? null,
        now,
        existing.id)
    else
      await t.run('INSERT INTO agents (id, user_id, machine, version, platforms, projects_json, busy_job_id, started_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', newId(), userId, input.machine, input.version ?? null, JSON.stringify(input.platforms), JSON.stringify(allowed), input.busyJobId ?? null, now, now)

    // Claims that were never started (agent restarted mid-handoff) go back to the queue.
    await t.run("UPDATE jobs SET status = 'queued', claimed_at = NULL WHERE machine = ? AND status = 'claimed' AND claimed_at < ?", input.machine,
      now - CLAIM_TIMEOUT_MS)

    if (input.busyJobId || !allowed.length) return null

    const ids = allowed.map(p => p.projectId)

    const row = ((await t.one(`SELECT * FROM jobs WHERE machine = ? AND status = 'queued' AND project_id IN (${ids.map(() => '?').join(',')})
         ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, input.machine, ...ids)) as JobRow | undefined)

    if (!row) return null

    const job = toJob(row)

    // An iOS build can't run on a machine that only does Android (not a Mac): fail it with a reason.
    if (job.kind === 'build' && !input.platforms.includes((job.params as BuildJobParams).platform)) {
      await t.run("UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?", 'iOS builds need a Mac.', now, job.id)

      return null
    }

    await t.run("UPDATE jobs SET status = 'claimed', claimed_at = ? WHERE id = ?", now, job.id)

    return { ...job, status: 'claimed' as const, claimed_at: now }
  })
}

// ---------- Jobs ----------

export const queueJob = async (input: {
  orgId: string
  projectId: string
  userId: string
  machine: string
  kind: JobKind
  params: BuildJobParams | SubmitJobParams | Partial<SubmitJobParams>

  /** Start only once this job's build has succeeded (status 'waiting' until then). */
  afterJobId?: string
}) => {
  const id = newId()

  await db.run(`INSERT INTO jobs (id, org_id, project_id, user_id, machine, kind, params_json, status, after_job_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
      input.orgId,
      input.projectId,
      input.userId,
      input.machine,
      input.kind,
      JSON.stringify(input.params),
      input.afterJobId ? 'waiting' : 'queued',
      input.afterJobId ?? null,
      Date.now())

  return id
}

export const getJob = async (id: string) => {
  const row = ((await db.one('SELECT * FROM jobs WHERE id = ?', id)) as JobRow | undefined)

  return row ? toJob(row) : null
}

/** Queued / starting jobs of a project, plus ones that ended in the last minutes without a run (errors). */
export const listPendingJobs = async (projectId: string) =>
  (
    ((await db.all(`SELECT * FROM jobs WHERE project_id = ? AND (status IN ('waiting', 'queued', 'claimed')
           OR (status = 'failed' AND run_id IS NULL AND finished_at > ?)
           OR (status = 'canceled' AND error LIKE 'Upload skipped%' AND finished_at > ?)) ORDER BY created_at ASC LIMIT 20`, projectId, Date.now() - 10 * 60_000, Date.now() - 10 * 60_000)) as JobRow[])
  ).map(toJob)

/** The CLI started by an agent reports the build / submission it created for the job (caller checks access). */
export const linkJobRun = async (jobId: string, runKind: 'builds' | 'submissions', runId: string) =>
  await db.run("UPDATE jobs SET status = 'running', run_kind = ?, run_id = ? WHERE id = ? AND status IN ('queued', 'claimed', 'running')", runKind, runId, jobId)

export const finishJob = async (jobId: string, status: 'done' | 'failed' | 'canceled', error?: string | null) => {

  await db.run("UPDATE jobs SET status = ?, error = COALESCE(?, error), finished_at = ? WHERE id = ? AND status IN ('claimed', 'running')", status,
    error ?? null,
    Date.now(),
    jobId)

  await releaseDependents(jobId)
}

/**
 * A build job ended: the upload waiting for it goes to the queue if the build produced a store file,
 * otherwise it's dropped with the reason.
 */
export const releaseDependents = async (jobId: string) => {
  const job = await getJob(jobId)
  const waiting = (((await db.all("SELECT * FROM jobs WHERE after_job_id = ? AND status = 'waiting'", jobId)) as JobRow[])).map(toJob)

  if (!job || !waiting.length) return

  const build = job.run_id
    ? ((await db.one('SELECT id, number, status, platform, artifact_path, distribution, dev_client FROM builds WHERE id = ?', job.run_id)) as
        | { id: string; number: number; status: string; platform: string; artifact_path: string | null; distribution: string | null; dev_client: number }
        | undefined)
    : undefined

  const reason = !build
    ? 'The build never started.'
    : build.status === 'canceled'
      ? `Build #${build.number} was canceled.`
      : build.status !== 'success'
        ? `Build #${build.number} failed.`
        : build.dev_client || build.distribution === 'internal' || build.distribution === 'simulator'
          ? `Build #${build.number} is not a store build (development / internal / simulator).`
          : !(build.platform === 'ios' ? build.artifact_path?.endsWith('.ipa') : build.artifact_path?.endsWith('.aab'))
            ? build.platform === 'ios'
              ? `Build #${build.number} produced no .ipa.`
              : `Build #${build.number} is an .apk: Google Play needs an .aab (set android.buildType to app-bundle).`
            : null

  for (const dep of waiting) {
    if (reason)
      await db.run("UPDATE jobs SET status = 'canceled', error = ?, finished_at = ? WHERE id = ?", `Upload skipped: ${reason}`, Date.now(), dep.id)
    else
      await db.run("UPDATE jobs SET status = 'queued', params_json = ? WHERE id = ?", JSON.stringify({ ...dep.params, buildId: build!.id }), dep.id)
  }
}

export const cancelQueuedJob = async (orgId: string, jobId: string) => {
  const changed =
    (await db.run("UPDATE jobs SET status = 'canceled', finished_at = ? WHERE id = ? AND org_id = ? AND status IN ('waiting', 'queued', 'claimed', 'failed')", Date.now(), jobId, orgId)).changes > 0

  // Its upload can't happen without it.
  if (changed) await releaseDependents(jobId)

  return changed
}

/** Jobs an agent's user may update: same organization membership. */
export const getJobForUser = async (userId: string, jobId: string) => {
  const row = ((await db.one('SELECT j.* FROM jobs j JOIN memberships m ON m.org_id = j.org_id AND m.user_id = ? WHERE j.id = ?', userId, jobId)) as JobRow | undefined)

  return row ? toJob(row) : null
}

/** The job that started this run, if it came from the dashboard (for Rebuild with the same options). */
export const jobForRun = async (runId: string) => {
  const row = ((await db.one('SELECT * FROM jobs WHERE run_id = ? ORDER BY created_at DESC LIMIT 1', runId)) as JobRow | undefined)

  return row ? toJob(row) : null
}

// ---------- Cancel ----------

/** Asks the CLI running this build / submission to stop (it checks every few seconds). */
export const requestCancel = async (kind: 'builds' | 'submissions', id: string) =>
  (await db.run(`UPDATE ${kind} SET cancel_requested_at = ? WHERE id = ? AND status = 'in_progress' AND cancel_requested_at IS NULL`, Date.now(), id)).changes > 0

export const isCancelRequested = async (kind: 'builds' | 'submissions', id: string) =>
  Boolean(((await db.one(`SELECT cancel_requested_at FROM ${kind} WHERE id = ?`, id)) as { cancel_requested_at: number | null } | undefined)?.cancel_requested_at)

const buildNumber = async (id: string) => ((await db.one('SELECT number FROM builds WHERE id = ?', id)) as { number: number } | undefined)?.number

/** The build an upload job is waiting for (once it exists). */
const afterBuild = async (j: Job) => {
  if (!j.after_job_id) return null
  const parent = await getJob(j.after_job_id)

  return parent?.run_id ? { id: parent.run_id, number: await buildNumber(parent.run_id) ?? 0 } : null
}

/** Queue strip on the Builds / Submissions pages. */
export const pendingJobsView = async (orgId: string, projectId: string, kind?: JobKind) => {
  const agents = await agentsForProject(orgId, projectId)

  const jobs = (await listPendingJobs(projectId)).filter(j => !kind || j.kind === kind)

  return Promise.all(
    jobs.map(async j => {
      const p = j.params as BuildJobParams & SubmitJobParams
      const after = await afterBuild(j)
      const uploadOf = after?.number ?? (p.buildId ? await buildNumber(p.buildId) : null)

      return {
        id: j.id,
        kind: j.kind,
        machine: j.machine,
        status: j.status,
        error: j.error,
        created_at: j.created_at,
        agentOnline: agents.some(a => a.machine === j.machine && a.online),
        label:
          j.kind === 'build'
            ? `${p.platform === 'ios' ? 'iOS' : 'Android'} build · ${p.profile}${p.submit || p.thenSubmit ? ' · then upload' : ''}${p.clean ? ' · clean' : ''}`
            : `Store upload${uploadOf ? ` of build #${uploadOf}` : ''}`,
        afterBuild: after
      }
    })
  )
}

/** Build profiles from the project's eas.json (what New build offers). */
export const profilesOf = (easJson: string | null) => {
  try {
    const names = Object.keys((JSON.parse(easJson ?? '{}') as { build?: Record<string, unknown> }).build ?? {})

    return names.length ? names : ['production', 'preview', 'development']
  } catch {
    return ['production', 'preview', 'development']
  }
}

export const agentChoices = async (orgId: string, projectId: string) =>
  (await agentsForProject(orgId, projectId)).map(a => ({ machine: a.machine, online: a.online, busy: Boolean(a.busy_job_id), platforms: a.platforms }))

export type UploadStep = { label: string; status: string; detail: string; href: string }

/**
 * The store upload of a build, as its last step on the build page: the submission once it exists
 * (click → its page), or the upload job waiting for / queued after this build.
 */
export const uploadStepFor = async (build: { id: string; platform: string; org_slug: string; project_slug: string }, submissions: { id: string; status: string; destination: string; created_at: number }[]): Promise<UploadStep | null> => {
  const base = `/${build.org_slug}/projects/${build.project_slug}/submissions`
  const store = build.platform === 'ios' ? 'TestFlight' : 'Google Play'
  const latest = [...submissions].sort((a, b) => b.created_at - a.created_at)[0]

  if (latest)
    return {
      label: `Upload to ${store}`,
      status: latest.status,
      detail: latest.status === 'success' ? 'uploaded' : latest.status === 'in_progress' ? 'uploading' : latest.status,
      href: `${base}/${latest.id}`
    }

  const buildJob = await jobForRun(build.id)

  const dep = buildJob
    ? (((await db.one('SELECT * FROM jobs WHERE after_job_id = ? ORDER BY created_at DESC LIMIT 1', buildJob.id)) as JobRow | undefined))
    : undefined

  const queued = dep ? toJob(dep) : null

  if (!queued) return null

  const detail: Record<string, string> = {
    waiting: 'waits for the build',
    queued: 'queued',
    claimed: 'starting…',
    running: 'uploading',
    done: 'done',
    failed: queued.error ?? 'failed',
    canceled: queued.error ?? 'skipped'
  }

  return {
    label: `Upload to ${store}`,
    status: queued.status === 'running' || queued.status === 'claimed' ? 'in_progress' : queued.status === 'canceled' ? 'skipped' : queued.status === 'done' ? 'success' : queued.status === 'failed' ? 'failed' : 'pending',
    detail: detail[queued.status] ?? queued.status,
    href: base
  }
}

/** Hide a line that ended without a run (start error, skipped upload) from the queue strip. */
export const dismissJob = async (orgId: string, jobId: string) =>
  (await db.run("UPDATE jobs SET status = 'dismissed' WHERE id = ? AND org_id = ? AND status IN ('failed', 'canceled')", jobId, orgId)).changes > 0
