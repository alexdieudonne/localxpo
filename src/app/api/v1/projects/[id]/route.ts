// Lib Imports
import { apiError, json, withAuth } from '@/lib/server/api'
import { getProjectForUser } from '@/lib/server/projects'

export const GET = withAuth<{ id: string }>(async (_req, { user }, { id }) => {
  const project = await getProjectForUser(user.id, id)

  return project ? json({ project }) : apiError(404, 'Project not found')
})
