// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { getJobForUser, linkJobRun } from '@/lib/server/jobs'
import { getBuildForUser } from '@/lib/server/builds'
import { getProjectForUser } from '@/lib/server/projects'
import { assertMachineAllowed, PlanLimitError } from '@/lib/server/billing'
import { createSubmission, listSubmissions, submissionPath } from '@/lib/server/submissions'

export const GET = withAuth(async (req, { user }) => {
  const project = await getProjectForUser(user.id, new URL(req.url).searchParams.get('projectId') ?? '')

  if (!project) return apiError(404, 'Project not found')

  return json({ submissions: (await listSubmissions(project.id, 50)).map(s => ({ ...s, url: submissionPath(s) })) })
})

const schema = z
  .object({
    buildId: z.string().min(1).nullish(),
    projectId: z.string().min(1).nullish(),
    platform: z.enum(['ios', 'android']).optional(),
    destination: z.string().min(1).max(100),
    artifactName: z.string().max(300).nullish(),
    appVersion: z.string().max(50).nullish(),
    buildNumber: z.string().max(50).nullish(),
    machine: z.string().max(200).nullish(),
    jobId: z.string().max(64).nullish()
  })
  .refine(v => v.buildId || (v.projectId && v.platform), { message: 'buildId, or projectId + platform, is required' })

/**
 * Opens a submission job. From a build (`buildId`), or for a file built elsewhere (`projectId` + `platform`).
 * The CLI then streams its logs to /submissions/:id/logs and PATCHes the outcome.
 */
export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    const d = body.data
    const build = d.buildId ? await getBuildForUser(user.id, d.buildId) : undefined

    if (d.buildId && !build) return apiError(404, 'Build not found')

    const project = build ? undefined : await getProjectForUser(user.id, d.projectId!)

    if (!build && !project) return apiError(404, 'Project not found')

    try {
      await assertMachineAllowed(build?.org_id ?? project!.org_id, d.machine)
    } catch (e) {
      if (e instanceof PlanLimitError) return apiError(402, e.message)
      throw e
    }

    const submission = await createSubmission({
      orgId: build?.org_id ?? project!.org_id,
      projectId: build?.project_id ?? project!.id,
      buildId: build?.id ?? null,
      userId: user.id,
      platform: build?.platform ?? d.platform!,
      destination: d.destination,
      appVersion: d.appVersion ?? build?.app_version,
      buildNumber: d.buildNumber ?? build?.build_number,
      artifactName: d.artifactName,
      machine: d.machine
    })

    const job = d.jobId ? await getJobForUser(user.id, d.jobId) : null

    if (job && job.project_id === submission.project_id && ['claimed', 'running'].includes(job.status)) await linkJobRun(job.id, 'submissions', submission.id)

    return json({ submission: { ...submission, url: submissionPath(submission) } }, 201)
  },
  { tokenOnly: true }
)
