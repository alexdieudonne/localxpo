// Third-party Imports
import Stripe from 'stripe'

import { CURRENCY, TRIAL_DAYS, lookupKey, parseLookupKey, type BillingInterval, type PaidPlanId } from '@/lib/plans'

import { getBilling, getBillingByCustomer, saveBilling, type BillingStatus, type OrgBilling } from './billing'
import { db } from './db'

/**
 * Stripe billing for localxpo Cloud: Checkout for new subscriptions, the Customer Portal for cards,
 * invoices and cancellation, in-place plan switches, and webhooks to keep org_billing in sync.
 * Needs STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET for /api/stripe/webhook). Prices are found by lookup key
 * (localxpo_pro_month, …), created by `pnpm stripe:setup`, so no price IDs need copying around.
 */

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY)

const g = globalThis as unknown as { __lxStripe?: Stripe; __lxPrices?: Map<string, string>; __lxPortalConfig?: string | null }

export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY

  if (!key) throw new Error('Billing is not set up on this server (STRIPE_SECRET_KEY is missing).')

  // STRIPE_API_BASE (optional): send API calls to stripe-mock or a local fake instead of api.stripe.com, for tests.
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null

  const local = base
    ? { host: base.hostname, port: Number(base.port) || (base.protocol === 'http:' ? 80 : 443), protocol: base.protocol === 'http:' ? ('http' as const) : ('https' as const) }
    : {}

  return (g.__lxStripe ??= new Stripe(key, { appInfo: { name: 'localxpo' }, ...local }))
}

export const isTestMode = () => process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false

/** Price ID for a plan, looked up once by its lookup key. */
export const priceId = async (plan: PaidPlanId, interval: BillingInterval) => {
  const key = lookupKey(plan, interval)
  const cache = (g.__lxPrices ??= new Map())
  const hit = cache.get(key)

  if (hit) return hit

  const { data } = await getStripe().prices.list({ lookup_keys: [key], active: true, limit: 1 })

  if (!data[0]) throw new Error(`No Stripe price with lookup key "${key}". Run \`pnpm stripe:setup\` once to create the plans in Stripe.`)
  if (data[0].currency !== CURRENCY) console.warn(`[billing] price ${key} is in ${data[0].currency}, expected ${CURRENCY}`)

  cache.set(key, data[0].id)

  return data[0].id
}

/** The portal configuration created by `pnpm stripe:setup` (plan switching between our prices), else Stripe's default. */
const portalConfiguration = async () => {
  if (process.env.STRIPE_PORTAL_CONFIGURATION) return process.env.STRIPE_PORTAL_CONFIGURATION
  if (g.__lxPortalConfig !== undefined) return g.__lxPortalConfig ?? undefined

  const { data } = await getStripe().billingPortal.configurations.list({ active: true, limit: 20 })

  g.__lxPortalConfig = data.find(c => c.metadata?.localxpo === '1')?.id ?? null

  return g.__lxPortalConfig ?? undefined
}

type OrgRef = { id: string; name: string; slug: string }

export const ensureCustomer = async (org: OrgRef, email: string) => {
  const billing = await getBilling(org.id)

  if (billing.stripe_customer_id) return billing.stripe_customer_id

  const customer = await getStripe().customers.create(
    { name: org.name, email, metadata: { org_id: org.id, org_slug: org.slug } },
    { idempotencyKey: `customer-${org.id}` }
  )

  await saveBilling(org.id, { stripe_customer_id: customer.id })

  return customer.id
}

const hasLiveSubscription = (b: OrgBilling) => Boolean(b.stripe_subscription_id) && ['active', 'trialing', 'past_due'].includes(b.status)

/**
 * Upgrade or switch plan. Without a subscription: a Checkout URL (14-day trial the first time).
 * With one: the price is swapped in place (prorated) and `url` is null.
 */
export const startCheckout = async (input: { org: OrgRef; email: string; plan: PaidPlanId; interval: BillingInterval; baseUrl: string }) => {
  const { org, plan, interval, baseUrl } = input
  const billing = await getBilling(org.id)
  const price = await priceId(plan, interval)
  const stripe = getStripe()

  if (hasLiveSubscription(billing)) {
    const sub = await stripe.subscriptions.retrieve(billing.stripe_subscription_id!)
    const item = sub.items.data[0]

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price }],
      proration_behavior: 'create_prorations',

      // Switching back to a paid plan undoes a scheduled cancellation.
      cancel_at_period_end: false,
      metadata: { ...sub.metadata, org_id: org.id }
    })

    await syncSubscription(updated, org.id)

    return { url: null as string | null }
  }

  const customer = await ensureCustomer(org, input.email)

  // Back through /api/billing/return, which applies the subscription before the dashboard renders.
  const back = `${baseUrl}/api/billing/return?org=${encodeURIComponent(org.slug)}&from=checkout`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: org.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer_update: { address: 'auto', name: 'auto' },
    subscription_data: {
      metadata: { org_id: org.id },
      ...(billing.trial_used ? {} : { trial_period_days: TRIAL_DAYS })
    },
    metadata: { org_id: org.id },
    success_url: `${back}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: back
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL.')

  return { url: session.url }
}

/** Customer Portal: cards, invoices, cancel, switch plan. */
export const portalUrl = async (org: OrgRef, email: string, baseUrl: string) => {
  const customer = await ensureCustomer(org, email)

  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${baseUrl}/api/billing/return?org=${encodeURIComponent(org.slug)}&from=portal`,
    configuration: await portalConfiguration()
  })

  return session.url
}

// ---------- Sync ----------

const STATUSES: BillingStatus[] = ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']
const ms = (s: number | null | undefined) => (s ? s * 1000 : null)

/** Writes a Stripe subscription onto the organization it belongs to. */
export const syncSubscription = async (sub: Stripe.Subscription, orgIdHint?: string | null) => {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const orgId = sub.metadata?.org_id || orgIdHint || (await getBillingByCustomer(customerId))?.org_id

  if (!orgId) {
    console.warn(`[billing] subscription ${sub.id} has no organization (customer ${customerId})`)

    return null
  }

  if (!(await db.one('SELECT 1 FROM organizations WHERE id = ?', orgId))) return null

  const current = await getBilling(orgId)

  // An old subscription's late event must not overwrite the one the organization uses now.
  if (current.stripe_subscription_id && current.stripe_subscription_id !== sub.id && hasLiveSubscription(current)) return current

  const item = sub.items.data[0]
  const parsed = parseLookupKey(item?.price.lookup_key)
  const status = (STATUSES as string[]).includes(sub.status) ? (sub.status as BillingStatus) : 'incomplete'
  const ended = status === 'canceled' || status === 'incomplete_expired'
  const periodEnd = ms(item?.current_period_end)

  await saveBilling(orgId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: ended ? null : sub.id,
    plan: ended || !parsed ? 'free' : parsed.plan,
    billing_interval: ended ? null : (parsed?.interval ?? null),
    status: ended ? 'canceled' : status,
    current_period_end: ended ? null : periodEnd,
    trial_end: ended ? null : ms(sub.trial_end),
    cancel_at: ended ? null : (ms(sub.cancel_at) ?? (sub.cancel_at_period_end ? periodEnd : null)),
    past_due_since: status === 'past_due' ? (current.status === 'past_due' && current.past_due_since ? current.past_due_since : Date.now()) : null,
    trial_used: current.trial_used || Boolean(sub.trial_start)
  })

  return getBilling(orgId)
}

/** Back from Checkout: apply the subscription now, without waiting for the webhook. */
export const syncCheckoutSession = async (sessionId: string, orgId: string) => {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })

  if (session.client_reference_id !== orgId) return null
  if (!session.subscription || typeof session.subscription === 'string') return null

  return syncSubscription(session.subscription, orgId)
}

/** Re-reads the subscription from Stripe (billing page), so changes show even when webhooks can't reach this server. */
export const refreshFromStripe = async (orgId: string) => {
  const billing = await getBilling(orgId)

  if (!billing.stripe_subscription_id) return billing

  return (await syncSubscription(await getStripe().subscriptions.retrieve(billing.stripe_subscription_id), orgId)) ?? billing
}

/** Deleting an organization cancels its subscription right away (no further charges). */
export const cancelForDeletedOrg = async (orgId: string) => {
  if (!stripeConfigured()) return

  const billing = await getBilling(orgId)

  if (billing.stripe_subscription_id && billing.status !== 'canceled')
    await getStripe()
      .subscriptions.cancel(billing.stripe_subscription_id, { prorate: true })
      .catch(e => console.error('[billing] cancel on delete failed', e))
}

// ---------- Webhooks ----------

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed'
])

export const handleWebhook = async (rawBody: string, signature: string | null) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not set'), { status: 500 })
  if (!signature) throw Object.assign(new Error('Missing Stripe-Signature header'), { status: 400 })

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (e) {
    throw Object.assign(new Error(`Invalid signature: ${(e as Error).message}`), { status: 400 })
  }

  if (!HANDLED.has(event.type)) return { received: true, ignored: event.type }

  const fresh = await db.run('INSERT INTO stripe_events (id, type, processed_at) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING', event.id, event.type, Date.now())

  if (fresh.changes === 0) return { received: true, duplicate: true }

  try {
    await applyEvent(event)
  } catch (e) {
    // Let Stripe retry: forget the event so the retry is processed.
    await db.run('DELETE FROM stripe_events WHERE id = ?', event.id)
    throw e
  }

  return { received: true }
}

const applyEvent = async (event: Stripe.Event) => {
  const stripe = getStripe()

  // Events can arrive out of order: always apply the subscription as it is now.
  const syncById = async (subId: string, orgHint?: string | null) => {
    try {
      await syncSubscription(await stripe.subscriptions.retrieve(subId), orgHint)
    } catch (e) {
      if ((e as { code?: string }).code !== 'resource_missing') throw e
    }
  }

  const obj = event.data.object as unknown as Record<string, unknown>

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session

    if (s.mode === 'subscription' && s.subscription) await syncById(typeof s.subscription === 'string' ? s.subscription : s.subscription.id, s.client_reference_id)

    return
  }

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription

    if (event.type === 'customer.subscription.deleted') await syncSubscription(sub)
    else await syncById(sub.id)

    return
  }

  // invoice.*: find the subscription through the customer.
  const customer = typeof obj.customer === 'string' ? obj.customer : null
  const billing = customer ? await getBillingByCustomer(customer) : undefined

  if (billing?.stripe_subscription_id) await syncById(billing.stripe_subscription_id, billing.org_id)
}
