// Next Imports
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Third-party Imports
import { CheckCircle2Icon, InfoIcon } from 'lucide-react'

// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PlanCards from '@/views/billing/plan-cards'
import PortalButton from '@/views/billing/portal-button'

// Lib Imports
import { formatHistory, formatPrice, PLANS, TRIAL_DAYS } from '@/lib/plans'
import { getOrgPlan, getUsage, graceEndsAt, isCloud, MACHINE_ACTIVE_DAYS, type OrgBilling } from '@/lib/server/billing'
import { requireOrg } from '@/lib/server/orgs'
import { refreshFromStripe, stripeConfigured, syncCheckoutSession } from '@/lib/server/stripe'

export const metadata = { title: 'Billing' }

const day = (ts: number | null) => (ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

const statusLine = (b: OrgBilling, planName: string) => {
  const grace = graceEndsAt(b)

  switch (b.status) {
    case 'trialing':
      return b.cancel_at ? `Trial ends ${day(b.trial_end)}, then back to Free.` : `Free trial until ${day(b.trial_end)}, then billed automatically.`
    case 'active':
      return b.cancel_at ? `Cancelled: ${planName} stays active until ${day(b.cancel_at)}, then Free.` : `Renews on ${day(b.current_period_end)}.`
    case 'past_due':
      return grace && grace > Date.now() ? `Payment failed. ${planName} is kept until ${day(grace)} while the card is retried.` : 'Payment failed. On Free until it goes through.'
    case 'incomplete':
      return 'Waiting for the first payment to complete.'
    case 'unpaid':
    case 'paused':
      return 'Subscription paused for missing payment. Update the card to resume.'
    default:
      return 'No subscription.'
  }
}

const Meter = ({ label, used, max, hint }: { label: string; used: number; max: number | null; hint?: string }) => {
  const pct = max === null ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100))
  const over = max !== null && used > max

  return (
    <div className='space-y-1.5'>
      <div className='flex items-baseline justify-between gap-2 text-sm'>
        <span className='font-medium'>{label}</span>
        <span className={over ? 'text-destructive font-medium tabular-nums' : 'text-muted-foreground tabular-nums'}>
          {used} / {max === null ? '∞' : max}
        </span>
      </div>
      <div className='bg-muted h-1.5 overflow-hidden rounded-full' role='meter' aria-valuenow={used} aria-valuemin={0} aria-valuemax={max ?? undefined} aria-label={label}>
        <div className={over ? 'bg-destructive h-full' : pct >= 80 ? 'h-full bg-amber-500' : 'bg-primary h-full'} style={{ width: `${max === null ? 4 : pct}%` }} />
      </div>
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

type Search = Promise<{ checkout?: string; session_id?: string }>

const BillingPage = async ({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Search }) => {
  if (!isCloud()) notFound()

  const { org } = await requireOrg((await params).org)
  const { checkout, session_id: sessionId } = await searchParams
  const configured = stripeConfigured()
  let syncError: string | null = null

  // Apply what happened in Stripe right away (webhooks may not reach a dev server).
  if (configured) {
    try {
      if (checkout === 'success' && sessionId) await syncCheckoutSession(sessionId, org.id)
      else await refreshFromStripe(org.id)
    } catch (e) {
      // Details go to the server log, not to the page.
      console.error('[billing] sync failed', e)
      syncError = 'sync'
    }
  }

  const { plan, billing } = await getOrgPlan(org.id)
  const usage = await getUsage(org.id)
  const isOwner = org.role === 'owner'
  const live = Boolean(billing.stripe_subscription_id) && ['active', 'trialing', 'past_due'].includes(billing.status)
  const paid = PLANS[billing.plan]

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Billing'
        description={`Plan and usage for ${org.name}. Builds always run on your own machines: the plan covers the dashboard, history and team features.`}
        actions={
          <>
            {isOwner && configured && billing.stripe_customer_id && <PortalButton orgSlug={org.slug} label='Invoices & payment method' />}
          </>
        }
      />

      {checkout === 'success' && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Thanks! {org.name} is on {plan.name}.</AlertTitle>
          <AlertDescription>{billing.status === 'trialing' ? `Your ${TRIAL_DAYS}-day trial has started. Nothing is charged before ${day(billing.trial_end)}.` : 'Receipts are emailed and listed under Invoices.'}</AlertDescription>
        </Alert>
      )}
      {checkout === 'canceled' && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Checkout was cancelled</AlertTitle>
          <AlertDescription>Nothing was charged. Pick a plan whenever you&apos;re ready.</AlertDescription>
        </Alert>
      )}
      {(!configured || syncError) && (
        <Alert>
          <InfoIcon />
          <AlertTitle>{configured ? 'The latest billing status couldn’t be loaded' : 'Upgrades aren’t available right now'}</AlertTitle>
          <AlertDescription>{configured ? 'Your plan below may be a few minutes behind. Reload the page to try again.' : 'Your organization stays on its current plan. Check back soon.'}</AlertDescription>
        </Alert>
      )}

      <div className='grid gap-4 lg:grid-cols-[1.2fr_1fr]'>
        <Card>
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className='flex flex-wrap items-center gap-2 text-2xl'>
              {plan.name}
              {billing.status === 'trialing' && <Badge variant='secondary'>Trial</Badge>}
              {billing.status === 'past_due' && <Badge variant='destructive'>Payment failed</Badge>}
              {billing.cancel_at && <Badge variant='outline'>Cancels {day(billing.cancel_at)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            {live && billing.billing_interval && (
              <p>
                <span className='font-medium'>{formatPrice(paid.price[billing.billing_interval])}</span>
                <span className='text-muted-foreground'> / {billing.billing_interval}, billed {billing.billing_interval === 'year' ? 'yearly' : 'monthly'}</span>
              </p>
            )}
            <p className='text-muted-foreground'>{statusLine(billing, paid.name)}</p>
            <p className='text-muted-foreground'>
              History is kept for {formatHistory(plan.limits.historyDays)}; older builds and submissions are removed automatically.
            </p>
            {!isOwner && <p className='text-muted-foreground'>Only owners of {org.name} can change the plan.</p>}
            {isOwner && billing.status === 'past_due' && configured && <PortalButton orgSlug={org.slug} label='Update payment method' variant='default' />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Usage</CardTitle>
            <CardDescription>Counted against the {plan.name} plan.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Meter label='Members' used={usage.members} max={plan.limits.members} />
            <Meter label='Build machines' used={usage.machines} max={plan.limits.machines} hint={`Machines that ran a build or submission in the last ${MACHINE_ACTIVE_DAYS} days.`} />
            <p className='text-muted-foreground text-xs'>
              <Link href={`/${org.slug}/members`} className='hover:text-foreground underline underline-offset-3'>
                Members
              </Link>
              {' · '}
              <Link href={`/${org.slug}/machines`} className='hover:text-foreground underline underline-offset-3'>
                Machines
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <section className='space-y-3 pt-2'>
        <h2 className='text-lg font-semibold'>Plans</h2>
        <PlanCards
          mode='org'
          orgSlug={org.slug}
          canManage={isOwner && configured}
          subscribed={live && billing.billing_interval ? { plan: billing.plan, interval: billing.billing_interval } : null}
          trialAvailable={!billing.trial_used}
        />
        <p className='text-muted-foreground text-center text-xs'>
          Prices in euros, per organization. Plan changes are prorated; cancelling keeps the plan until the end of the period.
        </p>
      </section>
    </div>
  )
}

export default BillingPage
