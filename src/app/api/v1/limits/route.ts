// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { getEffectiveLimits } from '@/lib/server/limits'
import { getProjectForUser } from '@/lib/server/projects'

/** GET ?projectId=…&machine=… → the resource limits the CLI applies to builds on that machine. */
export const GET = withAuth(
  async (req, { user }) => {
    const url = new URL(req.url)
    const project = await getProjectForUser(user.id, url.searchParams.get('projectId') ?? '')

    if (!project) return apiError(404, 'Project not found')

    return json(await getEffectiveLimits(project.org_id, url.searchParams.get('machine')))
  },
  { tokenOnly: true }
)
