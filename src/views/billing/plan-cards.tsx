'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { CheckIcon, Loader2Icon } from 'lucide-react'

// Component Imports
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { choosePlanAction, openPortalAction } from '@/lib/actions/billing'
import {
  formatHistory,
  formatLimit,
  formatPrice,
  PLAN_ORDER,
  PLANS,
  TRIAL_DAYS,
  type BillingInterval,
  type PlanId
} from '@/lib/plans'
import { cn } from '@/lib/utils'

export type PlanCardsProps =
  | { mode: 'public' }
  | {
      mode: 'org'
      orgSlug: string
      canManage: boolean

      /** The plan paid for and its period, when a subscription is live. */
      subscribed: { plan: PlanId; interval: BillingInterval } | null
      trialAvailable: boolean
    }

export const IntervalSwitch = ({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) => (
  <div className='bg-muted inline-grid grid-cols-2 rounded-lg p-0.5 text-sm font-medium' role='radiogroup' aria-label='Billing period'>
    {(['month', 'year'] as const).map(v => (
      <button
        key={v}
        type='button'
        role='radio'
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={cn('rounded-md px-3 py-1.5 transition', value === v ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground')}
      >
        {v === 'month' ? 'Monthly' : 'Yearly'}
        {v === 'year' && <span className='text-primary ml-1.5 text-xs'>2 months free</span>}
      </button>
    ))}
  </div>
)

const PlanCards = (props: PlanCardsProps) => {
  const [interval, setInterval] = useState<BillingInterval>(props.mode === 'org' && props.subscribed ? props.subscribed.interval : 'month')
  const [busy, setBusy] = useState<string | null>(null)
  const { run, pending } = useActionToast()

  const go = (key: string, fn: () => ReturnType<typeof choosePlanAction>, loading: string) => {
    setBusy(key)
    run(fn, { loading, success: 'Done.' })
  }

  const action = (id: PlanId) => {
    const plan = PLANS[id]

    if (props.mode === 'public')
      return (
        <Button className='w-full' variant={plan.popular ? 'default' : 'outline'} render={<Link href='/register' />} nativeButton={false}>
          {id === 'free' ? 'Start for free' : `Try ${plan.name} free for ${TRIAL_DAYS} days`}
        </Button>
      )

    const { orgSlug, canManage, subscribed, trialAvailable } = props
    const current = subscribed?.plan ?? 'free'
    const loading = pending && busy === id

    if (id === current && (id === 'free' || subscribed?.interval === interval))
      return (
        <Button className='w-full' variant='outline' disabled>
          Current plan
        </Button>
      )

    if (!canManage)
      return (
        <Button className='w-full' variant='outline' disabled>
          Owners can change plans
        </Button>
      )

    // Back to Free = cancel, done in the Stripe portal (at the end of the paid period).
    if (id === 'free')
      return (
        <Button className='w-full' variant='outline' disabled={pending} onClick={() => go(id, () => openPortalAction(orgSlug), 'Opening the billing portal…')}>
          {loading && <Loader2Icon className='animate-spin' />} Downgrade to Free
        </Button>
      )

    const label = !subscribed
      ? trialAvailable
        ? `Start ${TRIAL_DAYS}-day free trial`
        : `Upgrade to ${plan.name}`
      : id === current
        ? `Switch to ${interval === 'year' ? 'yearly' : 'monthly'}`
        : PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(current)
          ? `Upgrade to ${plan.name}`
          : `Downgrade to ${plan.name}`

    return (
      <Button
        className='w-full'
        variant={plan.popular && !subscribed ? 'default' : 'outline'}
        disabled={pending}
        onClick={() => go(id, () => choosePlanAction(orgSlug, id, interval), subscribed ? `Switching to ${plan.name}…` : 'Opening secure checkout…')}
      >
        {loading && <Loader2Icon className='animate-spin' />} {label}
      </Button>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='flex justify-center'>
        <IntervalSwitch value={interval} onChange={setInterval} />
      </div>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {PLAN_ORDER.map(id => {
          const plan = PLANS[id]
          const price = plan.price[interval]
          const current = props.mode === 'org' && (props.subscribed?.plan ?? 'free') === id

          return (
            <Card key={id} className={cn('relative flex flex-col', plan.popular && 'border-primary/60 ring-primary/20 ring-2', current && 'bg-muted/30')}>
              <CardHeader>
                <div className='flex items-center justify-between gap-2'>
                  <CardTitle className='text-lg'>
                    <h3>{plan.name}</h3>
                  </CardTitle>
                  {current ? <Badge variant='secondary'>Current</Badge> : plan.popular && <Badge>Most popular</Badge>}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
                <div className='pt-2'>
                  <span className='text-3xl font-semibold tabular-nums'>{formatPrice(price)}</span>
                  <span className='text-muted-foreground text-sm'>{price === 0 ? ' forever' : interval === 'year' ? ' / year' : ' / month'}</span>
                  {price > 0 && interval === 'year' && (
                    <p className='text-muted-foreground text-xs'>{formatPrice(Math.round((price / 12) * 100) / 100)} per month, billed yearly</p>
                  )}
                  {price > 0 && interval === 'month' && <p className='text-muted-foreground text-xs'>per organization</p>}
                </div>
              </CardHeader>
              <CardContent className='flex-1 space-y-4 text-sm'>
                <ul className='space-y-1.5'>
                  <li>{formatLimit(plan.limits.members, 'members')}</li>
                  <li>{formatLimit(plan.limits.machines, 'build machines')}</li>
                  <li>{formatHistory(plan.limits.historyDays)} of build history</li>
                  {plan.limits.storageGb > 0 && <li>{plan.limits.storageGb} GB of artifact storage</li>}
                </ul>
                <ul className='space-y-1.5 border-t pt-4'>
                  {plan.highlights.map(h => (
                    <li key={h} className='flex gap-2'>
                      <CheckIcon className='text-primary mt-0.5 size-4 shrink-0' />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>{action(id)}</CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default PlanCards
