// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, intParam, json, parseBody, withAuth } from '@/lib/server/api'
import { failUnresponsiveRuns, touchRun } from '@/lib/server/liveness'
import { appendLogs, getBuildForUser, getIssues, getLogs, getSteps } from '@/lib/server/builds'
import { db } from '@/lib/server/db'

type P = { id: string }

/**
 * GET ?after=<seq>&limit=<n>&step=<key>  → JSON page of lines (for the dashboard and `localxpo logs -f`)
 * GET ?format=text                        → the full log as a downloadable text file
 */
export const GET = withAuth<P>(async (req, { user }, { id }) => {
  await failUnresponsiveRuns()

  const build = await getBuildForUser(user.id, id)

  if (!build) return apiError(404, 'Build not found')

  const url = new URL(req.url)

  if (url.searchParams.get('format') === 'text') {
    const rows = ((await db.all('SELECT ts, step, line FROM build_logs WHERE build_id = ? ORDER BY seq', id)) as Iterable<{ ts: number; step: string; line: string }>)

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        for (const r of rows) controller.enqueue(encoder.encode(`${new Date(r.ts).toISOString()} [${r.step}] ${r.line}\n`))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="${build.project_slug}-${build.platform}-${build.number}.log"`
      }
    })
  }

  const after = intParam(url.searchParams.get('after'), -1, -1, Number.MAX_SAFE_INTEGER)
  const limit = intParam(url.searchParams.get('limit'), 2000, 1, 5000)
  const lines = await getLogs(id, { after: Number.isFinite(after) ? after : -1, limit, step: url.searchParams.get('step') ?? undefined })

  return json({
    lines,
    cursor: lines.length ? lines[lines.length - 1].seq : after,
    status: build.status,
    totalLines: build.log_lines,

    // Small enough to send on every poll: lets one request refresh the whole page.
    steps: await getSteps(id),
    issues: getIssues(build),
    finishedAt: build.finished_at
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
    if (!await getBuildForUser(user.id, id)) return apiError(404, 'Build not found')

    await touchRun('builds', id)

    const build = (await getBuildForUser(user.id, id))!

    const body = await parseBody(req, schema, 16 * 1024 * 1024)

    if (!body.ok) return body.response

    await appendLogs(build, body.data.lines)

    return json({ ok: true, received: body.data.lines.length })
  },
  { tokenOnly: true }
)
