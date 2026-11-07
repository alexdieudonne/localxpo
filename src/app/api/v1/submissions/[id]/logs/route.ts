// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, intParam, json, parseBody, withAuth } from '@/lib/server/api'
import { failUnresponsiveRuns, touchRun } from '@/lib/server/liveness'
import { db } from '@/lib/server/db'
import { appendSubmissionLogs, getSubmissionForUser, getSubmissionIssues, getSubmissionLogs } from '@/lib/server/submissions'

type P = { id: string }

/** Same contract as build logs, so the dashboard's live log viewer works for both. */
export const GET = withAuth<P>(async (req, { user }, { id }) => {
  await failUnresponsiveRuns()

  const sub = await getSubmissionForUser(user.id, id)

  if (!sub) return apiError(404, 'Submission not found')

  const url = new URL(req.url)

  if (url.searchParams.get('format') === 'text') {
    const rows = (await db.all('SELECT ts, line FROM submission_logs WHERE submission_id = ? ORDER BY seq', id)) as { ts: number; line: string }[]

    return new Response(rows.map(r => `${new Date(r.ts).toISOString()} ${r.line}`).join('\n') + '\n', {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="${sub.project_slug}-${sub.platform}-submission-${sub.id}.log"`
      }
    })
  }

  const after = intParam(url.searchParams.get('after'), -1, -1, Number.MAX_SAFE_INTEGER)
  const lines = await getSubmissionLogs(id, { after: Number.isFinite(after) ? after : -1, limit: intParam(url.searchParams.get('limit'), 2000, 1, 5000) })

  return json({
    lines,
    cursor: lines.length ? lines[lines.length - 1].seq : after,
    status: sub.status,
    totalLines: sub.log_lines,
    steps: [],
    issues: getSubmissionIssues(sub),
    finishedAt: sub.finished_at
  })
})

const schema = z.object({
  lines: z
    .array(
      z.object({
        seq: z.number().int().min(0),
        ts: z.number().int().optional(),
        step: z.string().max(40),
        stream: z.enum(['stdout', 'stderr', 'system']),
        line: z.string().max(20000)
      })
    )
    .max(5000)
})

export const POST = withAuth<P>(
  async (req, { user }, { id }) => {
    if (!await getSubmissionForUser(user.id, id)) return apiError(404, 'Submission not found')

    await touchRun('submissions', id)

    const sub = (await getSubmissionForUser(user.id, id))!

    const body = await parseBody(req, schema, 16 * 1024 * 1024)

    if (!body.ok) return body.response

    await appendSubmissionLogs(sub, body.data.lines)

    return json({ ok: true, received: body.data.lines.length })
  },
  { tokenOnly: true }
)
