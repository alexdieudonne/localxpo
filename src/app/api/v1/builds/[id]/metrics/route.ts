// Lib Imports
import { apiError, intParam, json, parseBody, withAuth } from '@/lib/server/api'
import { touchRun } from '@/lib/server/liveness'
import { getBuildForUser } from '@/lib/server/builds'
import { getMachine, getSamples, insightsFor, parseSummary, recordMetrics, typicalDuration } from '@/lib/server/metrics'
import { metricsSchema } from '@/lib/server/metrics-schema'

type P = { id: string }

/** GET → resource samples + summary of a build (dashboard chart). */
export const GET = withAuth<P>(async (req, { user }, { id }) => {
  const tail = intParam(new URL(req.url).searchParams.get('tail'), 0, 0, 5000) || undefined

  const build = await getBuildForUser(user.id, id)

  if (!build) return apiError(404, 'Build not found')

  const summary = parseSummary(build.metrics_json)
  const durationMs = build.started_at ? (build.finished_at ?? Date.now()) - build.started_at : null
  const finished = build.status === 'success' || build.status === 'failed'
  const insights = summary ? insightsFor(summary, { durationMs: finished ? durationMs : null, ...await typicalDuration(build), failed: build.status === 'failed' }) : []

  return json({ samples: await getSamples('builds', id, tail ? Math.min(tail, 2000) : undefined), summary, insights, machine: await getMachine(build.org_id, build.machine) })
})

/** POST (CLI) → machine description + resource samples taken during the build. */
export const POST = withAuth<P>(
  async (req, { user }, { id }) => {
    const build = await getBuildForUser(user.id, id)

    if (!build) return apiError(404, 'Build not found')

    await touchRun('builds', id)

    const body = await parseBody(req, metricsSchema)

    if (!body.ok) return body.response

    await recordMetrics('builds', build, body.data)

    return json({ ok: true, received: body.data.samples.length })
  },
  { tokenOnly: true }
)
