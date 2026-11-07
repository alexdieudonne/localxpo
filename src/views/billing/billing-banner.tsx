// Next Imports
import Link from 'next/link'

// Third-party Imports
import { AlertTriangleIcon, ClockIcon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Lib Imports
import { PLANS } from '@/lib/plans'
import { getOrgPlan, getUsage, graceEndsAt } from '@/lib/server/billing'

const day = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

/** One line above every organization page when billing needs attention (localxpo Cloud only). */
const BillingBanner = async ({ org }: { org: { id: string; slug: string; name: string; role: string } }) => {
  const { cloud, plan, billing } = await getOrgPlan(org.id)

  if (!cloud) return null

  const href = `/${org.slug}/billing`
  const isOwner = org.role === 'owner'
  const action = isOwner ? <Link href={href}>Open billing</Link> : <>Ask an owner of {org.name} to check billing.</>
  const now = Number(new Date())

  if (billing.status === 'past_due') {
    const grace = graceEndsAt(billing)
    const paid = PLANS[billing.plan].name

    return (
      <Alert variant='destructive' className='mb-6'>
        <AlertTriangleIcon />
        <AlertTitle>The last payment for {paid} failed</AlertTitle>
        <AlertDescription>
          {grace && grace > now
            ? `${org.name} keeps ${paid} until ${day(grace)} while the card is retried. `
            : `${org.name} is on Free until the payment goes through. `}
          {action}
        </AlertDescription>
      </Alert>
    )
  }

  const usage = await getUsage(org.id)

  const over = [
    plan.limits.members !== null && usage.members > plan.limits.members && `${usage.members} members (${plan.limits.members} included)`,
    plan.limits.machines !== null && usage.machines > plan.limits.machines && `${usage.machines} machines (${plan.limits.machines} included)`
  ].filter(Boolean)

  if (over.length) {
    return (
      <Alert className='mb-6'>
        <AlertTriangleIcon />
        <AlertTitle>
          {org.name} is over the {plan.name} plan: {over.join(' and ')}
        </AlertTitle>
        <AlertDescription>Everything keeps working, but new members and machines can&apos;t be added. {action}</AlertDescription>
      </Alert>
    )
  }

  if (billing.status === 'trialing' && billing.trial_end && billing.trial_end - now < 3 * 86_400_000 && !billing.cancel_at) {
    return (
      <Alert className='mb-6'>
        <ClockIcon />
        <AlertTitle>
          The {plan.name} trial ends on {day(billing.trial_end)}
        </AlertTitle>
        <AlertDescription>The card on file is charged then; cancel any time before. {isOwner && <Link href={href}>Manage</Link>}</AlertDescription>
      </Alert>
    )
  }

  return null
}

export default BillingBanner
