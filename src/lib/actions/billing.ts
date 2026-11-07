'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { isPaidPlanId, PLANS, type BillingInterval } from '@/lib/plans'
import { isCloud } from '@/lib/server/billing'
import { requireOrgAction } from '@/lib/server/orgs'
import { getServerUrl } from '@/lib/server/request-url'
import { portalUrl, startCheckout, stripeConfigured } from '@/lib/server/stripe'

const UNAVAILABLE = 'Upgrades aren’t available right now. Try again in a few minutes.'

const assertBilling = () => {
  if (!isCloud()) throw new Error('Plans are only available on localxpo Cloud.')
  if (!stripeConfigured()) throw new Error(UNAVAILABLE)
}

/** Payment-provider errors are logged for the operator; the user sees a plain message. */
const provider = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (e) {
    console.error('[billing]', e)
    throw new Error(UNAVAILABLE)
  }
}

/** Upgrade / switch plan. New subscription → Stripe Checkout; existing one → switched in place. */
export const choosePlanAction = async (orgSlug: string, plan: string, interval: BillingInterval): Promise<ActionResult> =>
  guard(async () => {
    assertBilling()

    const { user, org } = await requireOrgAction(orgSlug, { ownerOnly: true })

    if (!isPaidPlanId(plan)) return { error: 'Unknown plan.' }
    if (interval !== 'month' && interval !== 'year') return { error: 'Unknown billing period.' }

    const baseUrl = await getServerUrl()
    const { url } = await provider(() => startCheckout({ org, email: user.email, plan, interval, baseUrl }))

    if (url) return { redirectTo: url, message: 'Opening secure checkout…' }

    revalidatePath('/', 'layout')

    return { message: `${org.name} is now on ${PLANS[plan].name} (${interval === 'year' ? 'yearly' : 'monthly'}).` }
  })

/** Stripe Customer Portal: payment method, invoices, cancel. */
export const openPortalAction = async (orgSlug: string): Promise<ActionResult> =>
  guard(async () => {
    assertBilling()

    const { user, org } = await requireOrgAction(orgSlug, { ownerOnly: true })

    const baseUrl = await getServerUrl()

    return { redirectTo: await provider(() => portalUrl(org, user.email, baseUrl)), message: 'Opening the billing portal…' }
  })
