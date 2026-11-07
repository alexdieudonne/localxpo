'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { deleteCredential, saveCredential } from '@/lib/server/credentials'
import { requireOrgAction } from '@/lib/server/orgs'
import { checkAppleKey, checkGoogleServiceAccount } from '@/lib/server/store-auth'

import type { FormState } from './auth'

const MAX_FILE = 64 * 1024

const readFile = async (value: FormDataEntryValue | null) => {
  if (!value || typeof value === 'string' || value.size === 0) return null
  if (value.size > MAX_FILE) throw new Error('File is too large.')

  return (await value.text()).trim()
}

const appleSchema = z.object({
  keyId: z.string().trim().regex(/^[A-Z0-9]{10}$/, 'Key ID is 10 letters/digits, e.g. 2X9R4HXF34'),
  issuerId: z.string().trim().regex(/^[0-9a-f-]{36}$/i, 'Issuer ID is a UUID like 57246542-96fe-1a63-e053-0824d011072a'),
  teamId: z.string().trim().regex(/^[A-Z0-9]{10}$/, 'Team ID is 10 letters/digits, see developer.apple.com > Membership'),
  teamName: z.string().trim().max(100).optional()
})

export const saveAppleKeyAction = async (orgSlug: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { user, org } = await requireOrgAction(orgSlug, { ownerOnly: true })
  const parsed = appleSchema.safeParse(Object.fromEntries([...formData].filter(([, v]) => typeof v === 'string')))

  if (!parsed.success)
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])) }

  let p8: string | null

  try {
    p8 = await readFile(formData.get('p8'))
  } catch (e) {
    return { fieldErrors: { p8: (e as Error).message } }
  }

  if (!p8) return { fieldErrors: { p8: 'Choose the AuthKey_XXXX.p8 file you downloaded' } }
  if (!p8.includes('BEGIN PRIVATE KEY')) return { fieldErrors: { p8: 'This does not look like a .p8 private key' } }

  const check = await checkAppleKey(parsed.data.keyId, parsed.data.issuerId, p8)

  if (!check.ok && check.reason === 'rejected') return { error: check.message }

  await saveCredential(org.id, user.id, {
    kind: 'apple_asc_key',
    label: parsed.data.teamName ? `${parsed.data.teamName} (${parsed.data.teamId})` : `Team ${parsed.data.teamId}`,
    meta: parsed.data,
    secret: { p8 }
  })

  revalidatePath(`/${org.slug}`, 'layout')

  return {
    success: check.ok
      ? `Saved and verified with Apple${check.detail ? ` (${check.detail})` : ''}.`
      : `Saved, but not verified: ${check.message}`
  }
}

export const saveGoogleServiceAccountAction = async (orgSlug: string, _prev: FormState, formData: FormData): Promise<FormState> => {
  const { user, org } = await requireOrgAction(orgSlug, { ownerOnly: true })
  let raw: string | null

  try {
    raw = await readFile(formData.get('json'))
  } catch (e) {
    return { fieldErrors: { json: (e as Error).message } }
  }

  if (!raw) return { fieldErrors: { json: 'Choose the service account .json key file' } }

  let key: Record<string, string>

  try {
    key = JSON.parse(raw)
  } catch {
    return { fieldErrors: { json: 'This file is not valid JSON' } }
  }

  if (key.type !== 'service_account' || !key.client_email || !key.private_key)
    return { fieldErrors: { json: 'Expected a Google Cloud service account key (type "service_account")' } }

  const check = await checkGoogleServiceAccount(key.client_email, key.private_key)

  if (!check.ok && check.reason === 'rejected') return { error: check.message }

  await saveCredential(org.id, user.id, {
    kind: 'google_service_account',
    label: key.client_email,
    meta: { clientEmail: key.client_email, projectId: key.project_id ?? '' },
    secret: { json: raw }
  })

  revalidatePath(`/${org.slug}`, 'layout')

  return { success: check.ok ? 'Saved and verified with Google.' : `Saved, but not verified: ${check.message}` }
}

export const deleteCredentialAction = async (orgSlug: string, id: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug, { ownerOnly: true })

    await deleteCredential(org.id, id)
    revalidatePath(`/${org.slug}`, 'layout')
  })
