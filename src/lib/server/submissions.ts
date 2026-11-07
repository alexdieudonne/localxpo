import { newId } from './crypto'
import { db } from './db'
import { detectIssues, type BuildIssue, type LogLineInput } from './issues'

export type SubmissionStatus = 'in_progress' | 'success' | 'failed' | 'canceled'

export type Submission = {
  id: string
  org_id: string
  project_id: string
  build_id: string | null
  build_number_seq: number | null
  user_id: string
  submitted_by: string | null
  platform: 'ios' | 'android'
  destination: string
  status: SubmissionStatus
  app_version: string | null
  build_number: string | null
  artifact_name: string | null
  machine: string | null
  metrics_json: string | null
  cancel_requested_at: number | null
  error_message: string | null
  issues_json: string
  log_lines: number
  created_at: number
  finished_at: number | null
  last_contact_at: number | null
  lost_at: number | null
  project_slug: string
  org_slug: string
}

const SELECT = `SELECT s.*, b.number AS build_number_seq, u.name AS submitted_by, p.slug AS project_slug, o.slug AS org_slug
  FROM submissions s
  JOIN projects p ON p.id = s.project_id
  JOIN organizations o ON o.id = s.org_id
  LEFT JOIN builds b ON b.id = s.build_id
  LEFT JOIN users u ON u.id = s.user_id`

export const submissionPath = (s: Pick<Submission, 'org_slug' | 'project_slug' | 'id'>) =>
  `/${s.org_slug}/projects/${s.project_slug}/submissions/${s.id}`

export const isSubmissionFinished = (status: string) => status === 'success' || status === 'failed' || status === 'canceled'

export const listSubmissions = async (projectId: string, limit = 100) =>
  ((await db.all(`${SELECT} WHERE s.project_id = ? ORDER BY s.created_at DESC LIMIT ?`, projectId, limit)) as Submission[])

export const listSubmissionsForBuild = async (buildId: string) =>
  ((await db.all(`${SELECT} WHERE s.build_id = ? ORDER BY s.created_at DESC`, buildId)) as Submission[])

export const getSubmission = async (orgId: string, id: string) =>
  ((await db.one(`${SELECT} WHERE s.id = ? AND s.org_id = ?`, id, orgId)) as Submission | undefined)

/** Submission by id if the user belongs to its organization (API routes). */
export const getSubmissionForUser = async (userId: string, id: string) =>
  ((await db.one(`${SELECT} JOIN memberships m ON m.org_id = s.org_id AND m.user_id = ? WHERE s.id = ?`, userId, id)) as Submission | undefined)

export const getSubmissionIssues = (s: Pick<Submission, 'issues_json'>): BuildIssue[] => {
  try {
    return JSON.parse(s.issues_json) as BuildIssue[]
  } catch {
    return []
  }
}

export const createSubmission = async (input: {
  orgId: string
  projectId: string
  buildId: string | null
  userId: string
  platform: 'ios' | 'android'
  destination: string
  appVersion?: string | null
  buildNumber?: string | null
  artifactName?: string | null
  machine?: string | null
}) => {
  const id = newId()

  await db.run(`INSERT INTO submissions (id, org_id, project_id, build_id, user_id, platform, destination, status, app_version, build_number,
        artifact_name, machine, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)`, id,
      input.orgId,
      input.projectId,
      input.buildId,
      input.userId,
      input.platform,
      input.destination,
      input.appVersion ?? null,
      input.buildNumber ?? null,
      input.artifactName ?? null,
      input.machine ?? null,
      Date.now())

  return (await getSubmission(input.orgId, id))!
}

export const finishSubmission = async (
  sub: Submission,
  input: { status: Exclude<SubmissionStatus, 'in_progress'>; errorMessage?: string | null; finishedAt?: number }
) => {
  const reported =
    input.finishedAt && input.finishedAt <= Date.now() && input.finishedAt >= sub.created_at ? input.finishedAt : null

  await db.run('UPDATE submissions SET status = ?, error_message = ?, finished_at = COALESCE(finished_at, ?) WHERE id = ?', input.status, input.errorMessage ?? null, reported ?? Date.now(), sub.id)

  // A successful upload marks the build as submitted.
  if (input.status === 'success' && sub.build_id) (await db.run('UPDATE builds SET submitted = 1 WHERE id = ?', sub.build_id))
}

// ---------- Logs (same shape and rules as build logs) ----------

export const getSubmissionLogs = async (id: string, opts: { after?: number; limit?: number } = {}) =>
  (await db.all('SELECT seq, ts, step, stream, line FROM submission_logs WHERE submission_id = ? AND seq > ? ORDER BY seq LIMIT ?', id, opts.after ?? -1, Math.min(Math.max(opts.limit ?? 2000, 1), 10000))) as {
    seq: number
    ts: number
    step: string
    stream: string
    line: string
  }[]

export const appendSubmissionLogs = async (sub: Submission, lines: (LogLineInput & { ts?: number })[]) => {

  await db.tx(async t => {
    let inserted = 0

    for (const l of lines)
      inserted += (
        await t.run(
          'INSERT INTO submission_logs (submission_id, seq, ts, step, stream, line) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (submission_id, seq) DO NOTHING',
          sub.id,
          l.seq,
          l.ts ?? Date.now(),
          l.step,
          l.stream,
          l.line
        )
      ).changes

    const current = (await t.one<{ issues_json: string }>('SELECT issues_json FROM submissions WHERE id = ? FOR UPDATE', sub.id))!
    const issues = detectIssues(lines, getSubmissionIssues(current))

    await t.run('UPDATE submissions SET log_lines = log_lines + ?, issues_json = ? WHERE id = ?', inserted, JSON.stringify(issues), sub.id)
  })
}

export const deleteSubmission = async (orgId: string, id: string) =>
  await db.run('DELETE FROM submissions WHERE id = ? AND org_id = ?', id, orgId)
