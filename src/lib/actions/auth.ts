'use server'

// Next Imports
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Third-party Imports
import { z } from 'zod'

import {
  checkCredentials,
  clearFailedLogins,
  clientIp,
  loginRetryAfter,
  recordFailedLogin,
  retryMessage,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  getPasswordHash,
  requireUser,
  updateUserName,
  updateUserPassword
} from '@/lib/server/auth'
import { verifyPasswordAsync } from '@/lib/server/crypto'
import { isCloud } from '@/lib/server/billing'
import { createOrg, slugify, uniqueOrgSlug } from '@/lib/server/orgs'
import { COMPANY_SIZES, REFERRAL_SOURCES, USE_CASES, values as choiceValues } from '@/lib/signup'

export type FormState = {
  error?: string
  success?: string

  /** Set by actions that move you elsewhere: the form shows a toast, then navigates. */
  redirectTo?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

const fieldErrors = (err: z.ZodError) =>
  Object.fromEntries(err.issues.map(i => [String(i.path[0]), i.message])) as Record<string, string>

const passwordSchema = z.string().min(8, 'At least 8 characters').max(200, 'Too long')

const accountSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(100),
    email: z.string().trim().email('Enter a valid email'),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine(v => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

/** Steps 2 and 3 of sign-up, asked on localxpo Cloud only. */
const profileSchema = z
  .object({
    company: z.string().trim().min(1, 'Enter your company name').max(120, 'Keep it under 120 characters'),
    companySize: z.enum(choiceValues(COMPANY_SIZES), { message: 'Pick a team size' }),
    referralSource: z.enum(choiceValues(REFERRAL_SOURCES), { message: 'Tell us how you found localxpo' }),
    useCase: z.enum(choiceValues(USE_CASES), { message: 'Pick what you plan to do' }),
    useCaseDetails: z.string().trim().max(500, 'Keep it under 500 characters').optional().default('')
  })

/** Only same-site paths: `/\\evil.com`, `//evil.com`, control characters or absolute URLs fall back to `/`. */
const safeNext = (value: FormDataEntryValue | null) => {
  const next = typeof value === 'string' ? value : ''

   
  if (!next.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(next) || next.startsWith('//')) return '/'

  try {
    const url = new URL(next, 'http://localxpo.invalid')

    return url.origin === 'http://localxpo.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/'
  } catch {
    return '/'
  }
}

export const registerAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const raw = Object.fromEntries(formData) as Record<string, string>
  const account = accountSchema.safeParse(raw)
  const askProfile = isCloud()
  const profile = askProfile ? profileSchema.safeParse(raw) : null

  if (!account.success || (profile && !profile.success))
    return { fieldErrors: { ...(profile?.error ? fieldErrors(profile.error) : {}), ...(account.error ? fieldErrors(account.error) : {}) } }

  if (process.env.LOCALXPO_DISABLE_SIGNUP === '1') return { error: 'Registration is disabled on this server.' }

  if (await findUserByEmail(account.data.email)) return { fieldErrors: { email: 'An account already uses this email' } }

  const p = profile?.data
  const company = p?.company || null

  const user = await createUser(account.data.name, account.data.email, account.data.password, {
    company,
    companySize: p?.companySize,
    referralSource: p?.referralSource,
    useCase: p?.useCase,
    useCaseDetails: p?.useCaseDetails
  })

  // The first organization is the company given at sign-up (Cloud). Self-hosted sign-up has no company step: it's named after the user.
  const emailName = user.email.split('@')[0]
  const org = await createOrg(company || user.name, user.id, await uniqueOrgSlug(company && slugify(company) !== 'org' ? company : emailName))

  await createSession(user.id)
  redirect(`/${org.slug}`)
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password')
})

export const loginAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const raw = Object.fromEntries(formData) as Record<string, string>
  const parsed = loginSchema.safeParse(raw)
  const values = { email: raw.email ?? '' }

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values }

  const ip = clientIp(await headers())
  const wait = await loginRetryAfter(parsed.data.email, ip)

  if (wait) return { error: retryMessage(wait), values }

  const user = await checkCredentials(parsed.data.email, parsed.data.password)

  if (!user) {
    await recordFailedLogin(parsed.data.email, ip)

    return { error: 'Wrong email or password.', values }
  }

  await clearFailedLogins(parsed.data.email)

  await createSession(user.id)
  redirect(safeNext(formData.get('next')))
}

export const logoutAction = async () => {
  await destroySession()
  redirect('/login')
}

export const updateProfileAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const user = await requireUser()
  const name = z.string().trim().min(1, 'Enter your name').max(100).safeParse(formData.get('name'))

  if (!name.success) return { fieldErrors: { name: name.error.issues[0].message } }

  await updateUserName(user.id, name.data)

  return { success: 'Profile updated.' }
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine(v => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

export const changePasswordAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const user = await requireUser()
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }

  const hash = await getPasswordHash(user.id)

  if (!hash || !(await verifyPasswordAsync(parsed.data.currentPassword, hash)))
    return { fieldErrors: { currentPassword: 'Current password is wrong' } }

  await updateUserPassword(user.id, parsed.data.newPassword)

  return { success: 'Password changed.' }
}
