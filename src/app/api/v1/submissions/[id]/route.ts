// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { failUnresponsiveRuns, touchRun } from '@/lib/server/liveness'
import { finishSubmission, getSubmissionForUser, getSubmissionIssues, submissionPath, type Submission } from '@/lib/server/submissions'

type P = { id: string }

const present = (s: Submission) => {
  const rest: Partial<Submission> = { ...s }

  delete rest.issues_json

  return { ...rest, url: submissionPath(s), issues: getSubmissionIssues(s) }
}

export const GET = withAuth<P>(async (_req, { user }, { id }) => {
  await failUnresponsiveRuns()

  const sub = await getSubmissionForUser(user.id, id)

  return sub ? json({ submission: present(sub) }) : apiError(404, 'Submission not found')
})

const schema = z.object({
  status: z.enum(['success', 'failed', 'canceled']),
  errorMessage: z.string().max(2000).nullish(),
  finishedAt: z.number().int().positive().optional()
})

export const PATCH = withAuth<P>(
  async (req, { user }, { id }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    if (!await getSubmissionForUser(user.id, id)) return apiError(404, 'Submission not found')

    await touchRun('submissions', id)

    const sub = (await getSubmissionForUser(user.id, id))!

    await finishSubmission(sub, body.data)

    return json({ submission: present((await getSubmissionForUser(user.id, id))!) })
  },
  { tokenOnly: true }
)
