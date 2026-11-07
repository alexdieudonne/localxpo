// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { listAgentsForOrg } from '@/lib/server/jobs'
import { getOrgForUser } from '@/lib/server/orgs'

type P = { slug: string }

/** GET → live agent status for the Machines page (polled every few seconds). */
export const GET = withAuth<P>(async (_req, { user }, { slug }) => {
  const org = await getOrgForUser(user.id, slug)

  if (!org) return apiError(404, 'Organization not found')

  return json({
    now: Date.now(),
    agents: (await listAgentsForOrg(org.id)).map(a => ({
      machine: a.machine,
      online: a.online,
      busy: Boolean(a.busy_job_id),
      lastSeen: a.last_seen,
      version: a.version,
      platforms: a.platforms,
      projects: a.projects.length
    }))
  })
})
