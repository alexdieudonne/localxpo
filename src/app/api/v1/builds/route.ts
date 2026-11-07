// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, intParam, json, parseBody, withAuth } from '@/lib/server/api'
import { getJobForUser, linkJobRun } from '@/lib/server/jobs'
import { buildPath, createBuild, listBuilds } from '@/lib/server/builds'
import { getOrgForUser, listOrgsForUser } from '@/lib/server/orgs'
import { getProjectForUser } from '@/lib/server/projects'
import { assertMachineAllowed, PlanLimitError, pruneHistory } from '@/lib/server/billing'

/** ?projectId= scopes to one project; otherwise ?org= (default: the user's first org). */
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId')
  const project = projectId ? await getProjectForUser(user.id, projectId) : undefined

  if (projectId && !project) return apiError(404, 'Project not found')

  const orgSlug = url.searchParams.get('org')
  const orgId = project?.org_id ?? (orgSlug ? await getOrgForUser(user.id, orgSlug) : (await listOrgsForUser(user.id))[0])?.id

  if (!orgId) return apiError(404, 'Organization not found')

  const { rows, total } = await listBuilds(orgId, {
    projectId: project?.id,
    platform: url.searchParams.get('platform') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    limit: intParam(url.searchParams.get('limit'), 20, 1, 100),
    offset: intParam(url.searchParams.get('offset'), 0, 0, 1_000_000)
  })

  return json({ builds: rows.map(b => ({ ...b, url: buildPath(b) })), total })
})

const schema = z.object({
  projectId: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  profile: z.string().min(1).max(64),
  machine: z.string().max(200).nullish(),
  gitCommit: z.string().max(64).nullish(),
  gitBranch: z.string().max(200).nullish(),
  gitDirty: z.boolean().optional(),
  appVersion: z.string().max(50).nullish(),
  buildNumber: z.string().max(50).nullish(),
  cliVersion: z.string().max(50).nullish(),
  runner: z.enum(['local', 'agent']).optional(),
  devClient: z.boolean().optional(),
  distribution: z.enum(['store', 'internal', 'simulator']).nullish(),
  fingerprint: z.string().max(128).nullish(),
  jobId: z.string().max(64).nullish()
})

export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    const project = await getProjectForUser(user.id, body.data.projectId)

    if (!project) return apiError(404, 'Project not found')

    const { jobId, ...input } = body.data

    try {
      await assertMachineAllowed(project.org_id, input.machine)
    } catch (e) {
      if (e instanceof PlanLimitError) return apiError(402, e.message)
      throw e
    }

    await pruneHistory(project.org_id)

    const build = await createBuild(project.org_id, user.id, jobId ? { ...input, runner: 'agent' } : input)

    // Only a job of this same project, still waiting for its run, can be linked (not one from another org).
    const job = jobId ? await getJobForUser(user.id, jobId) : null

    if (job && job.project_id === project.id && ['claimed', 'running'].includes(job.status)) await linkJobRun(job.id, 'builds', build.id)

    return json({ build: { ...build, url: buildPath(build) } }, 201)
  },
  { tokenOnly: true }
)
