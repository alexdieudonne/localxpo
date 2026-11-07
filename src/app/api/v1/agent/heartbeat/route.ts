// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { json, parseBody, withAuth } from '@/lib/server/api'
import { agentHeartbeat } from '@/lib/server/jobs'
import { failUnresponsiveRuns } from '@/lib/server/liveness'

const schema = z.object({
  machine: z.string().min(1).max(200),
  version: z.string().max(50).optional(),
  platforms: z.array(z.enum(['ios', 'android'])).max(2),
  projects: z.array(z.object({ projectId: z.string().min(1).max(64), name: z.string().max(200).optional(), dir: z.string().max(500).optional() })).max(100),
  busyJobId: z.string().max(64).nullish()
})

/** POST (agent, every few seconds) → records the machine and returns the next job queued for it, if any. */
export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    // Agents call this every few seconds: a good clock for failing runs whose machine went silent.
    await failUnresponsiveRuns().catch(e => console.error('[liveness]', e))

    return json({ job: await agentHeartbeat(user.id, body.data) })
  },
  { tokenOnly: true }
)
