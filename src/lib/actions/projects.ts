'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { requireOrgAction } from '@/lib/server/orgs'
import { deleteProject, getProject, renameProject } from '@/lib/server/projects'

import type { FormState } from './auth'

export const renameProjectAction = async (orgSlug: string, projectId: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { org } = await requireOrgAction(orgSlug)
  const name = z.string().trim().min(1, 'Enter a name').max(100).safeParse(formData.get('name'))

  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } }
  if (!await getProject(org.id, projectId)) return { error: 'Project not found.' }

  await renameProject(org.id, projectId, name.data)
  revalidatePath('/', 'layout')

  return { success: 'Saved.' }
}

export const deleteProjectAction = async (orgSlug: string, projectId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug, { ownerOnly: true })
    const project = await getProject(org.id, projectId)

    await deleteProject(org.id, projectId)
    revalidatePath('/', 'layout')

    return { message: `${project?.name ?? 'Project'} was deleted.`, redirectTo: `/${org.slug}` }
  })
