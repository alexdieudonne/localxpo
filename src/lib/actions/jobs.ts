'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { CONTROL_MIN_CLI, cliAtLeast } from '@/lib/cli-version'
import { getBuild, updateBuild, type BuildRow } from '@/lib/server/builds'
import { db } from '@/lib/server/db'
import { agentsForProject, cancelQueuedJob, dismissJob, jobForRun, queueJob, requestCancel, type BuildJobParams } from '@/lib/server/jobs'
import { requireOrgAction } from '@/lib/server/orgs'
import { getProject } from '@/lib/server/projects'
import { finishSubmission, getSubmission } from '@/lib/server/submissions'

const buildSchema = z.object({
  platform: z.enum(['ios', 'android']),
  profile: z.string().trim().min(1).max(64),
  machine: z.string().min(1).max(200),
  submit: z.boolean().optional(),
  clean: z.boolean().optional()
})

/** Where the agent is, in words, for the toast. */
const whenItStarts = async (orgId: string, projectId: string, machine: string) => {
  const agent = (await agentsForProject(orgId, projectId)).find(a => a.machine === machine)

  if (!agent) return `Queued for ${machine}. It starts when \`npx localxpo agent\` runs there.`
  if (!agent.online) return `Queued for ${machine}. Its agent is offline: the build starts when it's back.`
  if (agent.busy_job_id) return `Queued on ${machine}, after the build it's running now.`

  return `Starting on ${machine} in a few seconds…`
}

/**
 * The build job, and when "submit" is on, a separate store-upload job that waits for it: it shows as its own
 * line in the queue and starts on the same machine once the build has produced its .ipa / .aab.
 */
const queueBuildWithUpload = async (
  orgId: string,
  projectId: string,
  userId: string,
  machine: string,
  params: { platform: 'ios' | 'android'; profile: string; submit?: boolean; clean?: boolean }
) => {
  const buildJob = await queueJob({
    orgId,
    projectId,
    userId,
    machine,
    kind: 'build',
    params: { platform: params.platform, profile: params.profile, clean: params.clean, thenSubmit: Boolean(params.submit) } satisfies BuildJobParams
  })

  if (params.submit) await queueJob({ orgId, projectId, userId, machine, kind: 'submit', params: { profile: params.profile }, afterJobId: buildJob })

  return buildJob
}

/** New build from the dashboard: queued for the agent on the chosen machine. */
export const queueBuildAction = async (orgSlug: string, projectId: string, input: z.infer<typeof buildSchema>): Promise<ActionResult> =>
  guard(async () => {
    const { user, org } = await requireOrgAction(orgSlug)
    const project = await getProject(org.id, projectId)

    if (!project) return { error: 'Project not found.' }

    const parsed = buildSchema.safeParse(input)

    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid build options.' }

    const { machine, ...params } = parsed.data
    const agent = (await agentsForProject(org.id, project.id)).find(a => a.machine === machine)

    if (agent && params.platform === 'ios' && !agent.platforms.includes('ios')) return { error: `${machine} can't build iOS: that needs a Mac with Xcode.` }

    await queueBuildWithUpload(org.id, project.id, user.id, machine, params)
    revalidatePath(`/${org.slug}/projects/${project.slug}`, 'layout')

    return { ok: true, message: `${await whenItStarts(org.id, project.id, machine)}${params.submit ? ' The store upload is queued after it.' : ''}` }
  })

/** Same platform / profile (and options, when it came from the dashboard), on the same machine by default. */
export const rebuildAction = async (orgSlug: string, buildId: string, machine?: string): Promise<ActionResult> =>
  guard(async () => {
    const { user, org } = await requireOrgAction(orgSlug)
    const build = await getBuild(org.id, buildId)

    if (!build) return { error: 'Build not found.' }

    const target = machine ?? build.machine

    if (!target) return { error: 'This build has no machine recorded: start a new build and pick one.' }

    const previous = await jobForRun(build.id)
    const prevParams = previous?.kind === 'build' ? (previous.params as BuildJobParams) : null

    await queueBuildWithUpload(org.id, build.project_id, user.id, target, {
      platform: build.platform,
      profile: build.profile,
      submit: Boolean(prevParams?.submit || prevParams?.thenSubmit),
      clean: prevParams?.clean ?? false
    })
    revalidatePath(`/${org.slug}`, 'layout')

    return { ok: true, message: await whenItStarts(org.id, build.project_id, target), redirectTo: `/${build.org_slug}/projects/${build.project_slug}/builds` }
  })

/** Upload a finished store build: runs `localxpo submit --build=<id>` on the machine that has the file. */
export const submitBuildAction = async (orgSlug: string, buildId: string): Promise<ActionResult> =>
  guard(async () => {
    const { user, org } = await requireOrgAction(orgSlug)
    const build = await getBuild(org.id, buildId)

    if (!build) return { error: 'Build not found.' }
    if (build.status !== 'success') return { error: 'Only successful builds can be submitted.' }
    if (!build.machine) return { error: 'This build has no machine recorded.' }

    await queueJob({ orgId: org.id, projectId: build.project_id, userId: user.id, machine: build.machine, kind: 'submit', params: { buildId: build.id, profile: build.profile } })
    revalidatePath(`/${org.slug}`, 'layout')

    return {
      ok: true,
      message: (await whenItStarts(org.id, build.project_id, build.machine)).replace('the build starts', 'the upload starts').replace('Starting on', 'Uploading from'),
      redirectTo: `/${build.org_slug}/projects/${build.project_slug}/submissions`
    }
  })

/** Try a failed / canceled submission again (same build, same machine). */
export const retrySubmissionAction = async (orgSlug: string, submissionId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const sub = await getSubmission(org.id, submissionId)

    if (!sub) return { error: 'Submission not found.' }
    if (!sub.build_id) return { error: 'This upload was for a file passed with --path: run `npx localxpo submit --path …` again on that machine.' }

    return submitBuildAction(orgSlug, sub.build_id)
  })

const lastActivity = async (kind: 'builds' | 'submissions', id: string) => {
  const table = kind === 'builds' ? 'build_logs' : 'submission_logs'
  const col = kind === 'builds' ? 'build_id' : 'submission_id'

  return ((await db.one(`SELECT MAX(ts) AS ts FROM ${table} WHERE ${col} = ?`, id)) as { ts: number | null }).ts
}

/** Silent for 2 minutes, or a CLI too old to listen: there is nobody to stop, just mark it. */
const cannotStopRemotely = (run: { cli_version?: string | null; created_at: number }, last: number | null) =>
  ('cli_version' in run && run.cli_version && !cliAtLeast(run.cli_version, CONTROL_MIN_CLI)) || Date.now() - (last ?? run.created_at) > 2 * 60_000

/** Cancel: the CLI on the build machine notices within ~3 s and stops everything, like Ctrl+C. */
export const cancelBuildAction = async (orgSlug: string, buildId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const build = await getBuild(org.id, buildId)

    if (!build) return { error: 'Build not found.' }
    if (build.status !== 'in_progress') return { message: 'This build has already ended.' }

    if (cannotStopRemotely(build, await lastActivity('builds', build.id))) {
      await updateBuild(build as BuildRow, { status: 'canceled', errorMessage: 'Canceled from the dashboard.' })
      revalidatePath(`/${org.slug}`, 'layout')

      return {
        ok: true,
        message:
          build.cli_version && !cliAtLeast(build.cli_version, CONTROL_MIN_CLI)
            ? `Marked as canceled. CLI v${build.cli_version} can't be stopped from the dashboard: press Ctrl+C in its terminal.`
            : 'Marked as canceled (the build machine had stopped reporting).'
      }
    }

    await requestCancel('builds', build.id)
    revalidatePath(`/${org.slug}`, 'layout')

    return { ok: true, message: `Stopping the build on ${build.machine ?? 'its machine'}…` }
  })

export const cancelSubmissionAction = async (orgSlug: string, submissionId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const sub = await getSubmission(org.id, submissionId)

    if (!sub) return { error: 'Submission not found.' }
    if (sub.status !== 'in_progress') return { message: 'This upload has already ended.' }

    if (Date.now() - ((await lastActivity('submissions', sub.id)) ?? sub.created_at) > 2 * 60_000) {
      await finishSubmission(sub, { status: 'canceled', errorMessage: 'Canceled from the dashboard.' })
      revalidatePath(`/${org.slug}`, 'layout')

      return { ok: true, message: 'Marked as canceled (the machine had stopped reporting).' }
    }

    await requestCancel('submissions', sub.id)
    revalidatePath(`/${org.slug}`, 'layout')

    return { ok: true, message: `Stopping the upload on ${sub.machine ?? 'its machine'}…` }
  })

export const cancelJobAction = async (orgSlug: string, jobId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)

    if (await dismissJob(org.id, jobId)) {
      revalidatePath(`/${org.slug}`, 'layout')

      return { ok: true, message: 'Dismissed.' }
    }

    if (!await cancelQueuedJob(org.id, jobId)) return { error: 'It already started: cancel the build itself.' }
    revalidatePath(`/${org.slug}`, 'layout')

    return { ok: true, message: 'Removed from the queue.' }
  })
