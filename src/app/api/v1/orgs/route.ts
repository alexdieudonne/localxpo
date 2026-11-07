// Lib Imports
import { json, withAuth } from '@/lib/server/api'
import { listOrgsForUser } from '@/lib/server/orgs'

export const GET = withAuth(async (_req, { user }) =>
  json({ orgs: (await listOrgsForUser(user.id)).map(o => ({ slug: o.slug, name: o.name, role: o.role })) })
)
