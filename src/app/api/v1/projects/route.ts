// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { getOrgForUser, listOrgsForUser } from '@/lib/server/orgs'
import { listProjects, SLUG_RE, upsertProject } from '@/lib/server/projects'
import { validateExpoConfig } from '@/lib/server/validate-config'

/** Org from ?org= / body.org, else the user's first organization (their personal one). */
const resolveOrg = async (userId: string, slug?: string | null) => (slug ? await getOrgForUser(userId, slug) : (await listOrgsForUser(userId))[0])

export const GET = withAuth(async (req, { user }) => {
  const org = await resolveOrg(user.id, new URL(req.url).searchParams.get('org'))

  if (!org) return apiError(404, 'Organization not found')

  return json({ org: { slug: org.slug, name: org.name }, projects: await listProjects(org.id) })
})

const schema = z.object({
  org: z.string().max(60).nullish(),
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_RE),
  iosBundleId: z.string().max(200).nullish(),
  androidPackage: z.string().max(200).nullish(),
  appVersion: z.string().max(50).nullish(),
  sdkVersion: z.string().max(50).nullish(),
  config: z.record(z.string(), z.unknown()).nullish(),
  eas: z.record(z.string(), z.unknown()).nullish()
})

/** Create or update a project by slug, and return config checks the CLI can print. */
export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    const org = await resolveOrg(user.id, body.data.org)

    if (!org) return apiError(404, `You are not a member of organization "${body.data.org}".`)

    const { org: _org, ...input } = body.data

    void _org

    const project = await upsertProject(org.id, user.id, { ...input, config: input.config ?? undefined, eas: input.eas ?? undefined })
    const checks = validateExpoConfig(input.config ?? null, input.eas ?? null)

    return json({ org: { slug: org.slug, name: org.name }, project, checks, url: `/${org.slug}/projects/${project.slug}` })
  },
  { tokenOnly: true }
)
