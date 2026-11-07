// Next Imports
import Link from 'next/link'

// Lib Imports
import { getOrgPlan, getUsage } from '@/lib/server/billing'
import { cn } from '@/lib/utils'

/** "2 / 3 members · Pro" next to a page title, linking to Billing (localxpo Cloud only). */
const PlanUsage = async ({ org, kind }: { org: { id: string; slug: string }; kind: 'members' | 'machines' }) => {
  const { cloud, plan } = await getOrgPlan(org.id)
  const max = plan.limits[kind]

  if (!cloud || max === null) return null

  const used = (await getUsage(org.id))[kind]
  const full = used >= max

  return (
    <Link
      href={`/${org.slug}/billing`}
      className={cn(
        'hover:bg-muted rounded-md border px-2.5 py-1 text-sm tabular-nums transition',
        full ? 'border-amber-500/50 text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
      )}
    >
      {used} / {max} {kind === 'members' ? 'members' : 'machines'} · {plan.name}
      {full && <span className='text-primary ml-1.5 font-medium'>Upgrade</span>}
    </Link>
  )
}

export default PlanUsage
