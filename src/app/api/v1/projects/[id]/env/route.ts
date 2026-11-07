// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { ENVIRONMENTS, envForEnvironment, type Environment } from '@/lib/server/env-vars'
import { getProjectForUser } from '@/lib/server/projects'

/** Decrypted variables for one environment, injected by the CLI into the build. */
export const GET = withAuth<{ id: string }>(
  async (req, { user }, { id }) => {
    const project = await getProjectForUser(user.id, id)

    if (!project) return apiError(404, 'Project not found')

    const environment = new URL(req.url).searchParams.get('environment') ?? 'production'

    if (!(ENVIRONMENTS as readonly string[]).includes(environment)) return apiError(400, 'Unknown environment')

    return json({ environment, variables: await envForEnvironment(project.id, environment as Environment) })
  },
  { tokenOnly: true }
)
