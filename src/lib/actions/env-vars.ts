'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { deleteEnvVar, ENV_NAME_RE, ENVIRONMENTS, setEnvVar, type Environment } from '@/lib/server/env-vars'
import { requireOrgAction } from '@/lib/server/orgs'
import { getProject } from '@/lib/server/projects'

import type { FormState } from './auth'

// Names Expo/EAS manage themselves or that would break the build environment.
const BLOCKED = /^(PATH|HOME|NODE_OPTIONS|CI|EAS_.*|LOCALXPO_.*)$/

export const setEnvVarAction = async (orgSlug: string, projectId: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { org } = await requireOrgAction(orgSlug)
  const project = await getProject(org.id, projectId)

  if (!project) return { error: 'Project not found.' }

  const name = String(formData.get('name') ?? '').trim()
  const value = String(formData.get('value') ?? '')
  const environments = ENVIRONMENTS.filter(e => formData.get(`env_${e}`) === 'on') as Environment[]
  const secret = formData.get('secret') === 'on'
  const values = { name, value: secret ? '' : value }

  if (!ENV_NAME_RE.test(name)) return { fieldErrors: { name: 'Letters, digits and underscores; must not start with a digit' }, values }
  if (BLOCKED.test(name)) return { fieldErrors: { name: `${name} is reserved` }, values }
  if (!value) return { fieldErrors: { value: 'Enter a value' }, values }
  if (value.length > 32_000) return { fieldErrors: { value: 'Too long' }, values }
  if (environments.length === 0) return { fieldErrors: { environments: 'Pick at least one environment' }, values }

  await setEnvVar(project.id, { name, value, environments, secret })
  revalidatePath(`/${org.slug}/projects/${project.slug}/environment-variables`)

  return { success: `${name} saved for ${environments.join(', ')}.` }
}

export const deleteEnvVarAction = async (orgSlug: string, projectId: string, id: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const project = await getProject(org.id, projectId)

    if (!project) return

    await deleteEnvVar(project.id, id)
    revalidatePath(`/${org.slug}/projects/${project.slug}/environment-variables`)
  })
