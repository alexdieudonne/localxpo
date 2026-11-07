/**
 * localxpo Cloud plans. Client-safe (no secrets): used by the pricing page, the billing page and the
 * server-side limit checks. Self-hosted installs (LOCALXPO_MODE unset) ignore all of this: everything is unlocked.
 *
 * Prices live in Stripe under the lookup keys below (`pnpm stripe:setup` creates them); the amounts here are
 * what the pricing page shows and what the setup script creates, so keep them in sync.
 */

export type PlanId = 'free' | 'pro' | 'team' | 'business'
export type PaidPlanId = Exclude<PlanId, 'free'>
export type BillingInterval = 'month' | 'year'

export type Feature = 'artifacts' | 'notifications' | 'github' | 'schedules' | 'smart_routing'

export type PlanLimits = {

  /** null = unlimited */
  members: number | null
  machines: number | null
  historyDays: number
  storageGb: number
}

export type Plan = {
  id: PlanId
  name: string
  tagline: string

  /** EUR, per month when billed monthly / per year when billed yearly. */
  price: { month: number; year: number }
  limits: PlanLimits
  features: Feature[]

  /** Shown on the pricing card (limits are rendered separately). */
  highlights: string[]
  popular?: boolean
}

export const CURRENCY = 'eur'
export const TRIAL_DAYS = 14

/** Days a plan stays active after a failed payment while Stripe retries the card. */
export const PAYMENT_GRACE_DAYS = 7

export const FEATURE_LABELS: Record<Feature, string> = {
  artifacts: 'Artifact hosting + install links with QR code',
  notifications: 'Slack, Discord, email and webhook notifications',
  github: 'GitHub: build on push or tag, PR checks',
  schedules: 'Scheduled builds',
  smart_routing: 'Smart routing across machines'
}

const PRO_FEATURES: Feature[] = ['artifacts', 'notifications', 'github', 'schedules']

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Build on your own machine, follow it from anywhere.',
    price: { month: 0, year: 0 },
    limits: { members: 1, machines: 1, historyDays: 7, storageGb: 0 },
    features: [],
    highlights: ['Live logs, metrics and error explanations', 'Store credentials and submissions', 'Dashboard-started builds']
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For indie developers shipping to the stores.',
    price: { month: 10, year: 100 },
    limits: { members: 3, machines: 3, historyDays: 90, storageGb: 10 },
    features: PRO_FEATURES,
    highlights: ['Everything in Free', ...PRO_FEATURES.map(f => FEATURE_LABELS[f])],
    popular: true
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'For small teams sharing a pool of build machines.',
    price: { month: 29, year: 290 },
    limits: { members: 10, machines: 10, historyDays: 365, storageGb: 50 },
    features: [...PRO_FEATURES, 'smart_routing'],
    highlights: ['Everything in Pro', FEATURE_LABELS.smart_routing]
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'For studios and agencies with many apps.',
    price: { month: 79, year: 790 },
    limits: { members: null, machines: null, historyDays: 730, storageGb: 200 },
    features: [...PRO_FEATURES, 'smart_routing'],
    highlights: ['Everything in Team', 'Unlimited members and machines', 'Priority support']
  }
}

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team', 'business']
export const PAID_PLANS: PaidPlanId[] = ['pro', 'team', 'business']

export const lookupKey = (plan: PaidPlanId, interval: BillingInterval) => `localxpo_${plan}_${interval}`

export const parseLookupKey = (key: string | null | undefined): { plan: PaidPlanId; interval: BillingInterval } | null => {
  const m = /^localxpo_(pro|team|business)_(month|year)$/.exec(key ?? '')

  return m ? { plan: m[1] as PaidPlanId, interval: m[2] as BillingInterval } : null
}

export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in PLANS
export const isPaidPlanId = (v: unknown): v is PaidPlanId => v === 'pro' || v === 'team' || v === 'business'

export const formatPrice = (eur: number) => (Number.isInteger(eur) ? `€${eur}` : `€${eur.toFixed(2)}`)

export const formatLimit = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `${n} ${n === 1 ? unit.replace(/s$/, '') : unit}`)

export const formatHistory = (days: number) => (days >= 365 && days % 365 === 0 ? `${days / 365} year${days > 365 ? 's' : ''}` : `${days} days`)
