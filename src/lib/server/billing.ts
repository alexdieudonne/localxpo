import { PAYMENT_GRACE_DAYS, PLANS, type BillingInterval, type Feature, type Plan, type PlanId, type PlanLimits, isPlanId } from '@/lib/plans'

import { db } from './db'

/**
 * Plans and limits. Only active in localxpo Cloud (LOCALXPO_MODE=cloud): a self-hosted server has no
 * billing, no limits and every feature.
 */

export const isCloud = () => process.env.LOCALXPO_MODE === 'cloud'

export type BillingStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused'

export type OrgBilling = {
  org_id: string

  /** The plan paid for (may differ from the effective plan, e.g. after a failed payment). */
  plan: PlanId
  billing_interval: BillingInterval | null
  status: BillingStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: number | null
  trial_end: number | null
  cancel_at: number | null
  past_due_since: number | null
  trial_used: boolean
  updated_at: number
}

const DAY = 86_400_000

const NONE = (orgId: string): OrgBilling => ({
  org_id: orgId,
  plan: 'free',
  billing_interval: null,
  status: 'none',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  current_period_end: null,
  trial_end: null,
  cancel_at: null,
  past_due_since: null,
  trial_used: false,
  updated_at: 0
})

export const getBilling = async (orgId: string): Promise<OrgBilling> => {
  const row = await db.one<OrgBilling>('SELECT * FROM org_billing WHERE org_id = ?', orgId)

  return row ? { ...row, plan: isPlanId(row.plan) ? row.plan : 'free' } : NONE(orgId)
}

export const getBillingByCustomer = async (customerId: string) =>
  db.one<OrgBilling>('SELECT * FROM org_billing WHERE stripe_customer_id = ?', customerId)

export const saveBilling = async (orgId: string, patch: Partial<Omit<OrgBilling, 'org_id' | 'updated_at'>>) => {
  const cols = Object.keys(patch) as (keyof typeof patch)[]
  const now = Date.now()

  await db.run(
    `INSERT INTO org_billing (org_id, updated_at${cols.map(c => `, ${c}`).join('')}) VALUES (?, ?${cols.map(() => ', ?').join('')})
     ON CONFLICT (org_id) DO UPDATE SET updated_at = excluded.updated_at${cols.map(c => `, ${c} = excluded.${c}`).join('')}`,
    orgId,
    now,
    ...cols.map(c => patch[c] ?? null)
  )
}

/** When the grace period after a failed payment ends (null when the plan isn't past due). */
export const graceEndsAt = (b: OrgBilling) => (b.status === 'past_due' && b.past_due_since ? b.past_due_since + PAYMENT_GRACE_DAYS * DAY : null)

/** The plan the organization gets right now, given its subscription status. */
export const effectivePlanId = (b: OrgBilling, now = Date.now()): PlanId => {
  if (b.status === 'active' || b.status === 'trialing') return b.plan
  if (b.status === 'past_due') return (graceEndsAt(b) ?? 0) > now ? b.plan : 'free'

  return 'free'
}

const SELF_HOSTED: Plan = {
  ...PLANS.business,
  id: 'business',
  name: 'Self-hosted',
  limits: { members: null, machines: null, historyDays: 36_500, storageGb: 1_000_000 },
  features: ['artifacts', 'notifications', 'github', 'schedules', 'smart_routing']
}

export type OrgPlan = { cloud: boolean; plan: Plan; billing: OrgBilling }

export const getOrgPlan = async (orgId: string): Promise<OrgPlan> => {
  if (!isCloud()) return { cloud: false, plan: SELF_HOSTED, billing: NONE(orgId) }

  const billing = await getBilling(orgId)

  return { cloud: true, plan: PLANS[effectivePlanId(billing)], billing }
}

export const hasFeature = async (orgId: string, feature: Feature) => (await getOrgPlan(orgId)).plan.features.includes(feature)

// ---------- Usage and limits ----------

/** A machine counts toward the limit while it has been used in the last 30 days. */
export const MACHINE_ACTIVE_DAYS = 30

export type Usage = { members: number; machines: number; storageBytes: number }

export const getUsage = async (orgId: string): Promise<Usage> => {
  const [members, machines] = await Promise.all([
    db.one<{ n: number }>('SELECT COUNT(*) AS n FROM memberships WHERE org_id = ?', orgId),
    db.one<{ n: number }>('SELECT COUNT(*) AS n FROM machines WHERE org_id = ? AND last_seen > ?', orgId, Date.now() - MACHINE_ACTIVE_DAYS * DAY)
  ])

  return { members: members?.n ?? 0, machines: machines?.n ?? 0, storageBytes: 0 }
}

export class PlanLimitError extends Error {
  constructor(
    message: string,
    readonly limit: keyof PlanLimits | Feature
  ) {
    super(message)
    this.name = 'PlanLimitError'
  }
}

const upgradeHint = (orgSlug?: string) => ` Upgrade on the Billing page${orgSlug ? ` (/${orgSlug}/billing)` : ''} to add more.`

/** Before adding a member. */
export const assertCanAddMember = async (orgId: string, orgSlug?: string) => {
  const { plan } = await getOrgPlan(orgId)
  const max = plan.limits.members

  if (max === null) return

  const { members } = await getUsage(orgId)

  if (members >= max) throw new PlanLimitError(`The ${plan.name} plan includes ${max} member${max === 1 ? '' : 's'}.${upgradeHint(orgSlug)}`, 'members')
}

/**
 * Before a build or submission runs on `machine`: machines already in use are always fine; a new one needs
 * room in the plan. The machine is recorded right away so it counts from its first run.
 */
export const assertMachineAllowed = async (orgId: string, machine: string | null | undefined, orgSlug?: string) => {
  if (!machine) return

  const now = Date.now()
  const known = await db.one<{ last_seen: number }>('SELECT last_seen FROM machines WHERE org_id = ? AND name = ?', orgId, machine)

  if (!known || known.last_seen <= now - MACHINE_ACTIVE_DAYS * DAY) {
    const { plan } = await getOrgPlan(orgId)
    const max = plan.limits.machines

    if (max !== null && (await getUsage(orgId)).machines >= max)
      throw new PlanLimitError(
        `"${machine}" would be machine ${max + 1}, and the ${plan.name} plan includes ${max}. Machines unused for ${MACHINE_ACTIVE_DAYS} days stop counting.${upgradeHint(orgSlug)}`,
        'machines'
      )
  }

  await db.run(
    `INSERT INTO machines (org_id, name, info_json, first_seen, last_seen) VALUES (?, ?, '{}', ?, ?)
     ON CONFLICT (org_id, name) DO UPDATE SET last_seen = excluded.last_seen`,
    orgId,
    machine,
    now,
    now
  )
}

// ---------- History retention ----------

const g = globalThis as unknown as { __lxPruned?: Map<string, number> }
const PRUNE_EVERY_MS = 3_600_000

/** Deletes builds, submissions and finished jobs older than the plan keeps. At most once an hour per org. */
export const pruneHistory = async (orgId: string, opts: { force?: boolean } = {}) => {
  if (!isCloud()) return 0

  const pruned = (g.__lxPruned ??= new Map())
  const last = pruned.get(orgId) ?? 0

  if (!opts.force && Date.now() - last < PRUNE_EVERY_MS) return 0
  pruned.set(orgId, Date.now())

  const { plan } = await getOrgPlan(orgId)
  const before = Date.now() - plan.limits.historyDays * DAY

  // Submissions first: they reference builds.
  const subs = await db.run(`DELETE FROM submissions WHERE org_id = ? AND created_at < ? AND status NOT IN ('queued', 'in_progress')`, orgId, before)
  const builds = await db.run(`DELETE FROM builds WHERE org_id = ? AND created_at < ? AND status NOT IN ('queued', 'in_progress')`, orgId, before)

  await db.run(`DELETE FROM jobs WHERE org_id = ? AND created_at < ? AND status IN ('done', 'failed', 'canceled', 'dismissed')`, orgId, before)

  return subs.changes + builds.changes
}
