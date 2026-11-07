// Lib Imports
import { apiError, intParam, json, parseBody, withAuth } from '@/lib/server/api'
import { touchRun } from '@/lib/server/liveness'
import { getSubmissionForUser } from '@/lib/server/submissions'
import { getMachine, getSamples, insightsFor, parseSummary, recordMetrics } from '@/lib/server/metrics'
import { metricsSchema } from '@/lib/server/metrics-schema'

type P = { id: string }

/** GET → resource samples + summary of a submission (dashboard chart). */
export const GET = withAuth<P>(async (req, { user }, { id }) => {
  const tail = intParam(new URL(req.url).searchParams.get('tail'), 0, 0, 5000) || undefined

  const submission = await getSubmissionForUser(user.id, id)

  if (!submission) return apiError(404, 'Submission not found')

  const summary = parseSummary(submission.metrics_json)
  const insights = summary ? insightsFor(summary, { durationMs: null, typicalMs: null, typicalCount: 0, failed: submission.status === 'failed' }) : []

  return json({ samples: await getSamples('submissions', id, tail ? Math.min(tail, 2000) : undefined), summary, insights, machine: await getMachine(submission.org_id, submission.machine) })
})

/** POST (CLI) → machine description + resource samples taken during the submission. */
export const POST = withAuth<P>(
  async (req, { user }, { id }) => {
    const submission = await getSubmissionForUser(user.id, id)

    if (!submission) return apiError(404, 'Submission not found')

    await touchRun('submissions', id)

    const body = await parseBody(req, metricsSchema)

    if (!body.ok) return body.response

    await recordMetrics('submissions', submission, body.data)

    return json({ ok: true, received: body.data.samples.length })
  },
  { tokenOnly: true }
)
