// React Imports
import crypto from 'node:crypto'

import { cache } from 'react'

// Node Imports

// Next Imports
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from './db'
import { hashPasswordAsync, newId, sha256, verifyPasswordAsync } from './crypto'

export const SESSION_COOKIE = 'lx_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type User = {
  id: string
  name: string
  email: string
  created_at: number
}

// ---------- Users ----------

export const findUserByEmail = async (email: string) =>
  (await db.one('SELECT * FROM users WHERE lower(email) = lower(?)', email.trim())) as
    | (User & { password_hash: string })
    | undefined

/** Answers from the sign-up steps (localxpo Cloud). Every field is optional: older accounts have none. */
export type SignupProfile = {
  company?: string | null
  companySize?: string | null
  referralSource?: string | null
  useCase?: string | null
  useCaseDetails?: string | null
}

export const createUser = async (name: string, email: string, password: string, profile: SignupProfile = {}): Promise<User> => {
  const user: User = { id: newId(), name: name.trim(), email: email.trim().toLowerCase(), created_at: Date.now() }

  await db.run(
    `INSERT INTO users (id, name, email, password_hash, created_at, company, company_size, referral_source, use_case, use_case_details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.name,
    user.email,
    await hashPasswordAsync(password),
    user.created_at,
    profile.company || null,
    profile.companySize || null,
    profile.referralSource || null,
    profile.useCase || null,
    profile.useCaseDetails || null
  )

  return user
}

let dummy: Promise<string> | undefined
const dummyHash = () => (dummy ??= hashPasswordAsync(crypto.randomBytes(16).toString('hex')))

/** Returns the user when the email/password pair is valid. Constant-ish time on unknown emails. */
export const checkCredentials = async (email: string, password: string): Promise<User | null> => {
  const row = await findUserByEmail(email)

  if (!row) {
    // Same work as a real check (one scrypt against a precomputed hash) so timing doesn't reveal which emails exist.
    await verifyPasswordAsync(password, await dummyHash())

    return null
  }

  if (!(await verifyPasswordAsync(password, row.password_hash))) return null

  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at }
}

export const updateUserName = async (userId: string, name: string) =>
  await db.run('UPDATE users SET name = ? WHERE id = ?', name.trim(), userId)

export const updateUserPassword = async (userId: string, password: string) =>
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPasswordAsync(password), userId)

export const getPasswordHash = async (userId: string) =>
  ((await db.one('SELECT password_hash FROM users WHERE id = ?', userId)) as { password_hash: string } | undefined)
    ?.password_hash

// ---------- Browser sessions ----------

export const createSession = async (userId: string) => {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + SESSION_TTL_MS

  await db.run('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', sha256(token), userId, expiresAt, Date.now())

  const jar = await cookies()

  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.LOCALXPO_INSECURE_COOKIES !== '1',
    path: '/',
    expires: new Date(expiresAt)
  })
}

export const destroySession = async () => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value

  if (token) (await db.run('DELETE FROM sessions WHERE id = ?', sha256(token)))
  jar.delete(SESSION_COOKIE)
}

const userFromSessionToken = async (token: string | undefined): Promise<User | null> => {
  if (!token) return null

  const row = ((await db.one(`SELECT u.id, u.name, u.email, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, sha256(token))) as (User & { expires_at: number }) | undefined)

  if (!row || row.expires_at < Date.now()) return null

  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at }
}

/** Current user from the session cookie, memoised per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies()

  return userFromSessionToken(jar.get(SESSION_COOKIE)?.value)
})

/** Use at the top of every protected page / server action. */
export const requireUser = async (): Promise<User> => {
  const user = await getCurrentUser()

  // An expired session still has its cookie, which keeps the visitor away from the public home page:
  // drop it first (cookies can't be changed while rendering a page), then continue to the home page.
  if (!user && (await cookies()).has(SESSION_COOKIE)) redirect('/api/session/clear')
  if (!user) redirect('/login')

  return user
}

// ---------- API tokens (CLI) ----------

export type ApiToken = {
  id: string
  name: string
  prefix: string
  last_used_at: number | null
  created_at: number
}

export const createApiToken = async (userId: string, name: string): Promise<{ token: string; record: ApiToken }> => {
  const token = `lx_${crypto.randomBytes(24).toString('base64url')}`

  const record: ApiToken = {
    id: newId(),
    name: name.trim() || 'CLI',
    prefix: token.slice(0, 10),
    last_used_at: null,
    created_at: Date.now()
  }

  await db.run('INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)', record.id, userId, record.name, sha256(token), record.prefix, record.created_at)

  return { token, record }
}

export const listApiTokens = async (userId: string) =>
  ((await db.all('SELECT id, name, prefix, last_used_at, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC', userId)) as ApiToken[])

export const revokeApiToken = async (userId: string, tokenId: string) =>
  await db.run('DELETE FROM api_tokens WHERE id = ? AND user_id = ?', tokenId, userId)

const userFromApiToken = async (token: string): Promise<User | null> => {

  const row = ((await db.one(`SELECT u.id, u.name, u.email, u.created_at, t.id AS token_id
       FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`, sha256(token))) as (User & { token_id: string }) | undefined)

  if (!row) return null

  await db.run('UPDATE api_tokens SET last_used_at = ? WHERE id = ?', Date.now(), row.token_id)

  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at }
}

export type RequestAuth = { user: User; via: 'token' | 'session' }

/**
 * API route auth. Bearer tokens (CLI) work for every method; the browser session cookie is
 * accepted for safe (GET) requests only, so cookies can't be used for cross-site writes.
 */
export const authenticateRequest = async (req: Request): Promise<RequestAuth | null> => {
  const header = req.headers.get('authorization')

  if (header?.toLowerCase().startsWith('bearer ')) {
    const user = await userFromApiToken(header.slice(7).trim())

    return user ? { user, via: 'token' } : null
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const cookie = req.headers.get('cookie') ?? ''
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))
    const user = await userFromSessionToken(match ? decodeURIComponent(match[1]) : undefined)

    return user ? { user, via: 'session' } : null
  }

  return null
}

// ---------- Sign-in rate limiting ----------
// Failed attempts are counted per email and per IP over 15 minutes, in the database so every server instance
// sees the same numbers.

const WINDOW_MS = 15 * 60_000
const MAX_PER_EMAIL = 8
const MAX_PER_IP = 40

const keys = (email: string, ip: string | null) => [`email:${email.trim().toLowerCase()}`, ...(ip ? [`ip:${ip}`] : [])]

/** Seconds to wait before trying again, or 0 when signing in is allowed. */
export const loginRetryAfter = async (email: string, ip: string | null) => {
  const since = Date.now() - WINDOW_MS
  const [byEmail, byIp] = keys(email, ip)

  const rows = await db.all<{ key: string; n: number; first: number }>(
    'SELECT key, COUNT(*) AS n, MIN(at) AS first FROM login_attempts WHERE key IN (?, ?) AND at > ? GROUP BY key',
    byEmail,
    byIp ?? byEmail,
    since
  )

  const over = rows.find(r => (r.key === byEmail && r.n >= MAX_PER_EMAIL) || (r.key === byIp && r.n >= MAX_PER_IP))

  return over ? Math.max(1, Math.ceil((over.first + WINDOW_MS - Date.now()) / 1000)) : 0
}

export const recordFailedLogin = async (email: string, ip: string | null) => {
  const now = Date.now()

  for (const key of keys(email, ip)) await db.run('INSERT INTO login_attempts (key, at) VALUES (?, ?)', key, now)

  // Keep the table small.
  if (Math.random() < 0.05) await db.run('DELETE FROM login_attempts WHERE at < ?', now - WINDOW_MS)
}

export const clearFailedLogins = async (email: string) =>
  await db.run('DELETE FROM login_attempts WHERE key = ?', `email:${email.trim().toLowerCase()}`)

/** Client IP as seen by the hosting platform (first X-Forwarded-For hop), or null. */
export const clientIp = (headers: Headers) => headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

export const retryMessage = (seconds: number) =>
  `Too many sign-in attempts. Try again in ${seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`}.`
