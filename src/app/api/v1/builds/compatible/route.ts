// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { buildPath, findCompatibleBuild } from '@/lib/server/builds'
import { getProjectForUser } from '@/lib/server/projects'

/**
 * GET ?projectId&platform&fingerprint&profile → latest successful build with the same native fingerprint.
 * The CLI uses it to tell you a rebuild isn't needed when only JavaScript changed.
 */
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url)
  const [projectId, platform, fingerprint, profile] = ['projectId', 'platform', 'fingerprint', 'profile'].map(k => url.searchParams.get(k))

  if (!projectId || !platform || !fingerprint || !profile) return apiError(400, 'projectId, platform, fingerprint and profile are required')

  const project = await getProjectForUser(user.id, projectId)

  if (!project) return apiError(404, 'Project not found')

  const build = await findCompatibleBuild(project.id, platform, fingerprint, profile)

  return json({
    build: build
      ? { id: build.id, number: build.number, created_at: build.created_at, artifact_path: build.artifact_path, url: buildPath(build) }
      : null
  })
})
