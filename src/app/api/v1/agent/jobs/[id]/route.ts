// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { finishJob, getJobForUser } from '@/lib/server/jobs'

type P = { id: string }

const schema = z.object({ status: z.enum(['done', 'failed', 'canceled']), error: z.string().max(2000).nullish() })

/** PATCH (agent) → the job's CLI process ended. */
export const PATCH = withAuth<P>(
  async (req, { user }, { id }) => {
    const job = await getJobForUser(user.id, id)

    if (!job) return apiError(404, 'Job not found')

    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    await finishJob(job.id, body.data.status, body.data.error)

    return json({ ok: true })
  },
  { tokenOnly: true }
)
