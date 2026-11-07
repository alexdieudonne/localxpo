// Next Imports
import { notFound } from 'next/navigation'

import { requireUser, type User } from './auth'
import { newId } from './crypto'
import { db } from './db'

export type Role = 'owner' | 'member'

export type Org = { id: string; name: string; slug: string; created_at: number }
export type OrgWithRole = Org & { role: Role }

export type Member = { user_id: string; name: string; email: string; role: Role; created_at: number }

/** Top-level URL segments an organization slug can't take. */
const RESERVED = new Set(['login', 'register', 'account', 'builds', 'api', 'new', 'settings', 'projects', 'images', 'favicon.ico', '_next', 'pricing', 'billing'])

export const ORG_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org'

const slugTaken = async (slug: string) =>
  RESERVED.has(slug) || Boolean((await db.one('SELECT 1 FROM organizations WHERE lower(slug) = lower(?)', slug)))

export const isOrgSlugAvailable = async (slug: string) => ORG_SLUG_RE.test(slug) && !await slugTaken(slug)

export const uniqueOrgSlug = async (base: string) => {
  const root = slugify(base)
  let slug = root

  for (let i = 2; await slugTaken(slug); i++) slug = `${root}-${i}`

  return slug
}

export const createOrg = async (name: string, ownerId: string, slug?: string): Promise<Org> => {
  const org: Org = { id: newId(), name: name.trim(), slug: slug ?? await uniqueOrgSlug(name), created_at: Date.now() }

  await db.tx(async t => {
    await t.run('INSERT INTO organizations (id, name, slug, created_at) VALUES (?, ?, ?, ?)', org.id, org.name, org.slug, org.created_at)
    await t.run(`INSERT INTO memberships (org_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`, org.id, ownerId, org.created_at)
  })

  return org
}

export const listOrgsForUser = async (userId: string) =>
  ((await db.all(`SELECT o.*, m.role FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ? ORDER BY m.created_at`, userId)) as OrgWithRole[])

export const getOrgForUser = async (userId: string, slug: string) =>
  ((await db.one(`SELECT o.*, m.role FROM organizations o JOIN memberships m ON m.org_id = o.id
       WHERE lower(o.slug) = lower(?) AND m.user_id = ?`, slug, userId)) as OrgWithRole | undefined)

export const getRole = async (userId: string, orgId: string) =>
  ((await db.one('SELECT role FROM memberships WHERE org_id = ? AND user_id = ?', orgId, userId)) as { role: Role } | undefined)
    ?.role

/** Page guard: signed in AND member of the org in the URL (404 otherwise, so org names don't leak). */
export const requireOrg = async (slug: string): Promise<{ user: User; org: OrgWithRole }> => {
  const user = await requireUser()
  const org = await getOrgForUser(user.id, slug)

  if (!org) notFound()

  // Builds whose machine went silent are failed before the page reads them (throttled, shared).
  const { failUnresponsiveRuns } = await import('./liveness')

  await failUnresponsiveRuns().catch(e => console.error('[liveness]', e))

  return { user, org }
}

export const updateOrg = async (orgId: string, input: { name?: string; slug?: string }) => {

  if (input.name) (await db.run('UPDATE organizations SET name = ? WHERE id = ?', input.name.trim(), orgId))
  if (input.slug) (await db.run('UPDATE organizations SET slug = ? WHERE id = ?', input.slug, orgId))
}

export const deleteOrg = async (orgId: string) => (await db.run('DELETE FROM organizations WHERE id = ?', orgId))

// ---------- Members ----------

export const listMembers = async (orgId: string) =>
  ((await db.all(`SELECT m.user_id, u.name, u.email, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ? ORDER BY m.role DESC, m.created_at`, orgId)) as Member[])

export const addMember = async (orgId: string, userId: string, role: Role = 'member') =>
  await db.run('INSERT INTO memberships (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (org_id, user_id) DO NOTHING', orgId, userId, role, Date.now())

export const setMemberRole = async (orgId: string, userId: string, role: Role) =>
  await db.run('UPDATE memberships SET role = ? WHERE org_id = ? AND user_id = ?', role, orgId, userId)

export const removeMember = async (orgId: string, userId: string) =>
  await db.run('DELETE FROM memberships WHERE org_id = ? AND user_id = ?', orgId, userId)

export const ownerCount = async (orgId: string) =>
  ((await db.one(`SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'owner'`, orgId)) as { n: number }).n

/** Server-action guard. `ownerOnly` for settings, members and credentials changes. */
export const requireOrgAction = async (slug: string, opts: { ownerOnly?: boolean } = {}) => {
  const user = await requireUser()
  const org = await getOrgForUser(user.id, slug)

  if (!org) throw new Error('Organization not found')
  if (opts.ownerOnly && org.role !== 'owner') throw new Error('Only organization owners can do this.')

  return { user, org }
}
