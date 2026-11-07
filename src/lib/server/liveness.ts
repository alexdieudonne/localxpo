import { db } from './db'
import { finishJob, releaseDependents } from './jobs'

/**
 * A running build or submission whose CLI stops talking to the dashboard is marked failed.
 *
 * While it runs, the CLI asks /control every 3 s and ships logs and metrics, so silence means the process was
 * killed, the machine went to sleep or lost the network. If it comes back (laptop woken up), its next request
 * puts the run back in progress and the build carries on as if nothing happened.
 */

export type RunKind = 'builds' | 'submissions'

/** No request from the CLI for this long → failed. */
export const NO_CONTACT_MS = 3 * 60_000

const SWEEP_EVERY_MS = 15_000

export const lostMessage = (kind: RunKind) =>
  `The ${kind === 'builds' ? 'build' : 'upload'} machine stopped responding (no contact for ${NO_CONTACT_MS / 60_000} minutes): the localxpo process was stopped, or the machine went to sleep or offline. If it comes back, this ${kind === 'builds' ? 'build' : 'upload'} resumes here.`

/** Every request from the CLI about a run: records the contact and revives a run marked lost. */
export const touchRun = async (kind: RunKind, id: string) => {
  const now = Date.now()

  const lost = await db.one<{ lost_at: number }>(`SELECT lost_at FROM ${kind} WHERE id = ? AND lost_at IS NOT NULL AND status = 'failed'`, id)

  if (lost) {
    await db.run(
      `UPDATE ${kind} SET status = 'in_progress', lost_at = NULL, error_message = NULL, finished_at = NULL, last_contact_at = ? WHERE id = ?`,
      now,
      id
    )

    // Only the steps that were cut off when the run was marked lost.
    if (kind === 'builds')
      await db.run(`UPDATE build_steps SET status = 'in_progress', finished_at = NULL WHERE build_id = ? AND status = 'failed' AND finished_at = ?`, id, lost.lost_at)
    await db.run(`UPDATE jobs SET status = 'running', finished_at = NULL, error = NULL WHERE run_id = ? AND status = 'failed'`, id)

    return true
  }

  await db.run(`UPDATE ${kind} SET last_contact_at = ? WHERE id = ?`, now, id)

  return false
}

const g = globalThis as unknown as { __lxLastSweep?: number; __lxSweep?: Promise<number> }

/**
 * Marks silent runs as failed. Cheap and throttled: called before pages and API routes read runs. Callers that
 * arrive while a sweep is running wait for it (a layout and its page render in parallel), so nothing is read
 * half-swept.
 */
export const failUnresponsiveRuns = async (opts: { force?: boolean } = {}): Promise<number> => {
  if (g.__lxSweep) return g.__lxSweep
  if (!opts.force && Date.now() - (g.__lxLastSweep ?? 0) < SWEEP_EVERY_MS) return 0

  g.__lxLastSweep = Date.now()
  g.__lxSweep = sweep().finally(() => (g.__lxSweep = undefined))

  return g.__lxSweep
}

const sweep = async () => {
  const now = Date.now()

  const before = now - NO_CONTACT_MS
  let total = 0

  for (const kind of ['builds', 'submissions'] as const) {
    const started = kind === 'builds' ? 'started_at' : 'created_at'

    const lost = await db.all<{ id: string }>(
      `UPDATE ${kind} SET status = 'failed', lost_at = ?, finished_at = ?, error_message = ?
       WHERE status IN ('queued', 'in_progress') AND COALESCE(last_contact_at, ${started}, created_at) < ?
       RETURNING id`,
      now,
      now,
      lostMessage(kind),
      before
    )

    for (const { id } of lost) {
      if (kind === 'builds')
        await db.run(`UPDATE build_steps SET status = 'failed', finished_at = COALESCE(finished_at, ?) WHERE build_id = ? AND status = 'in_progress'`, now, id)

      // The agent job behind it fails too, and an upload waiting for this build is released (skipped).
      const job = await db.one<{ id: string }>(`SELECT id FROM jobs WHERE run_id = ? AND status IN ('claimed', 'running')`, id)

      if (job) await finishJob(job.id, 'failed', lostMessage(kind))
      else {
        const done = await db.one<{ id: string }>(`SELECT id FROM jobs WHERE run_id = ?`, id)

        if (done) await releaseDependents(done.id)
      }
    }

    total += lost.length
  }

  if (total) console.log(`[localxpo] ${total} run(s) marked failed: no contact from their machine for ${NO_CONTACT_MS / 60_000} min`)

  return total
}
