// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { touchRun } from '@/lib/server/liveness'
import { getBuildForUser } from '@/lib/server/builds'

type P = { id: string }

/** GET (CLI, every few seconds while running) → whether someone pressed Cancel on the dashboard. */
export const GET = withAuth<P>(
  async (_req, { user }, { id }) => {
    if (!await getBuildForUser(user.id, id)) return apiError(404, 'Not found')

    // The CLI asks every 3 s while it runs: this is its heartbeat.
    await touchRun('builds', id)

    const run = (await getBuildForUser(user.id, id))!

    return json({ cancel: Boolean(run.cancel_requested_at), status: run.status })
  },
  { tokenOnly: true }
)
