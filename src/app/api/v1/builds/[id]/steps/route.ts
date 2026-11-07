// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { touchRun } from '@/lib/server/liveness'
import { getBuildForUser, getSteps, STEP_STATUSES, upsertStep } from '@/lib/server/builds'

const schema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).max(100),
  status: z.enum(STEP_STATUSES)
})

export const PUT = withAuth<{ id: string }>(
  async (req, { user }, { id }) => {
    if (!await getBuildForUser(user.id, id)) return apiError(404, 'Build not found')

    await touchRun('builds', id)

    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    await upsertStep(id, body.data)

    return json({ steps: await getSteps(id) })
  },
  { tokenOnly: true }
)
