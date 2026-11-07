'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { findUserByEmail, requireUser } from '@/lib/server/auth'
import {
  addMember,
  createOrg,
  deleteOrg,
  isOrgSlugAvailable,
  listMembers,
  listOrgsForUser,
  ORG_SLUG_RE,
  ownerCount,
  removeMember,
  requireOrgAction,
  setMemberRole,
  slugify,
  updateOrg,
  type Role
} from '@/lib/server/orgs'

import { guard, type ActionResult } from '@/lib/action-result'
import { assertCanAddMember, PlanLimitError } from '@/lib/server/billing'
import { cancelForDeletedOrg } from '@/lib/server/stripe'

import type { FormState } from './auth'

const nameSchema = z.string().trim().min(1, 'Enter a name').max(60, 'Too long')

export const createOrgAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const user = await requireUser()
  const name = nameSchema.safeParse(formData.get('name'))
  const slug = slugify(String(formData.get('slug') || formData.get('name') || ''))

  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } }
  if (!ORG_SLUG_RE.test(slug)) return { fieldErrors: { slug: 'Use lowercase letters, digits and dashes' }, values: { name: name.data, slug } }
  if (!await isOrgSlugAvailable(slug)) return { fieldErrors: { slug: 'This URL is taken' }, values: { name: name.data, slug } }

  const org = await createOrg(name.data, user.id, slug)

  // The sidebar (rail) lives in the shared layout: refresh it so the new organization shows up now.
  revalidatePath('/', 'layout')

  return { success: `${org.name} is ready.`, redirectTo: `/${org.slug}` }
}

export const updateOrgAction = async (orgSlug: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { org } = await requireOrgAction(orgSlug, { ownerOnly: true })
  const name = nameSchema.safeParse(formData.get('name'))
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()

  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } }
  if (!ORG_SLUG_RE.test(slug)) return { fieldErrors: { slug: 'Use lowercase letters, digits and dashes (max 40)' } }
  if (slug !== org.slug && !await isOrgSlugAvailable(slug)) return { fieldErrors: { slug: 'This URL is taken' } }

  await updateOrg(org.id, { name: name.data, slug: slug === org.slug ? undefined : slug })
  revalidatePath('/', 'layout')

  return { success: 'Organization updated.', redirectTo: slug !== org.slug ? `/${slug}/settings` : undefined }
}

export const deleteOrgAction = async (orgSlug: string): Promise<ActionResult> =>
  guard(async () => {
    const { user, org } = await requireOrgAction(orgSlug, { ownerOnly: true })
    const remaining = (await listOrgsForUser(user.id)).filter(o => o.id !== org.id)

    if (remaining.length === 0) return { error: 'You need at least one organization.' }

    await cancelForDeletedOrg(org.id)
    await deleteOrg(org.id)
    revalidatePath('/', 'layout')

    return { message: `${org.name} was deleted.`, redirectTo: `/${remaining[0].slug}` }
  })

export const addMemberAction = async (orgSlug: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { org } = await requireOrgAction(orgSlug, { ownerOnly: true })
  const email = z.string().trim().email('Enter a valid email').safeParse(formData.get('email'))
  const role = formData.get('role') === 'owner' ? 'owner' : 'member'

  if (!email.success) return { fieldErrors: { email: email.error.issues[0].message } }

  const invitee = await findUserByEmail(email.data)

  if (!invitee)
    return { fieldErrors: { email: 'No account with this email yet. Ask them to register first, then add them here.' }, values: { email: email.data } }

  if ((await listMembers(org.id)).some(m => m.user_id === invitee.id)) return { fieldErrors: { email: `${invitee.name} is already a member` } }

  try {
    await assertCanAddMember(org.id, org.slug)
  } catch (e) {
    if (e instanceof PlanLimitError) return { fieldErrors: { email: e.message }, values: { email: email.data } }
    throw e
  }

  await addMember(org.id, invitee.id, role)
  revalidatePath(`/${org.slug}/members`)

  return { success: `${invitee.name} now has access to ${org.name}.` }
}

export const setMemberRoleAction = async (orgSlug: string, userId: string, role: Role): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug, { ownerOnly: true })

    if (role !== 'owner' && role !== 'member') return { error: 'Unknown role.' }

    if (role === 'member' && await ownerCount(org.id) <= 1 && (await listMembers(org.id)).find(m => m.user_id === userId)?.role === 'owner')
      return { error: 'An organization needs at least one owner.' }

    await setMemberRole(org.id, userId, role)
    revalidatePath(`/${org.slug}/members`)
  })

/** Owners can remove anyone; members can remove themselves (leave). */
export const removeMemberAction = async (orgSlug: string, userId: string): Promise<ActionResult> =>
  guard(async () => {
    const user = await requireUser()
    const { org } = await requireOrgAction(orgSlug, { ownerOnly: userId !== user.id })
    const target = (await listMembers(org.id)).find(m => m.user_id === userId)

    if (target?.role === 'owner' && await ownerCount(org.id) <= 1) return { error: 'An organization needs at least one owner.' }

    await removeMember(org.id, userId)
    revalidatePath('/', 'layout')

    if (userId === user.id) return { message: `You left ${org.name}.`, redirectTo: '/' }

    return { message: `${target?.name ?? 'Member'} was removed.` }
  })
