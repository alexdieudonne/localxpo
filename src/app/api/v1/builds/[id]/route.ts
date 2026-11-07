// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { failUnresponsiveRuns, touchRun } from '@/lib/server/liveness'
import { BUILD_STATUSES, buildPath, getBuildForUser, getIssues, getSteps, updateBuild, type BuildRow } from '@/lib/server/builds'

type P = { id: string }

const present = async (build: BuildRow) => {
  const rest: Partial<BuildRow> = { ...build }

  delete rest.issues_json

  return { ...rest, url: buildPath(build), issues: getIssues(build), steps: await getSteps(build.id) }
}

export const GET = withAuth<P>(async (_req, { user }, { id }) => {
  await failUnresponsiveRuns()

  const build = await getBuildForUser(user.id, id)

  return build ? json({ build: await present(build) }) : apiError(404, 'Build not found')
})

const schema = z.object({
  status: z.enum(BUILD_STATUSES).optional(),
  errorMessage: z.string().max(2000).nullish(),
  artifactPath: z.string().max(1000).nullish(),
  submitted: z.boolean().optional(),
  appVersion: z.string().max(50).nullish(),
  buildNumber: z.string().max(50).nullish(),

  // Sent by the CLI so builds synced after an outage keep their real duration.
  finishedAt: z.number().int().positive().optional(),
  fingerprint: z.string().max(128).nullish()
})

export const PATCH = withAuth<P>(
  async (req, { user }, { id }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    if (!await getBuildForUser(user.id, id)) return apiError(404, 'Build not found')

    // A build marked lost that reports in (machine woke up) is back in progress before its result is saved.
    await touchRun('builds', id)

    const build = (await getBuildForUser(user.id, id))!

    return json({ build: await present((await updateBuild(build, body.data))!) })
  },
  { tokenOnly: true }
)
