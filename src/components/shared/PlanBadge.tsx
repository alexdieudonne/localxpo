// Third-party Imports
import { SparklesIcon } from 'lucide-react'

// Util Imports
import { cn } from '@/lib/utils'

export type PlanTier = 'free' | 'pro' | 'team' | 'business'

export const isPaidTier = (tier: string | null | undefined): tier is Exclude<PlanTier, 'free'> => tier === 'pro' || tier === 'team' || tier === 'business'

type Props = {
  tier: PlanTier
  label: string
  trial?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** The organization's plan: a quiet chip on Free, the same chip tinted with the primary color (and a small icon) on paid plans. */
const PlanBadge = ({ tier, label, trial = false, size = 'sm', className }: Props) => {
  const paid = isPaidTier(tier)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border font-medium',
        size === 'sm' ? 'gap-1 px-1.5 py-px text-[11px] [&_svg]:size-3' : 'gap-1 px-2 py-0.5 text-xs [&_svg]:size-3',
        paid ? 'border-primary/15 bg-primary/[0.06] text-primary' : 'text-muted-foreground bg-muted border-transparent',
        className
      )}
    >
      {paid && <SparklesIcon aria-hidden />}
      {label}
      {trial && <span className='opacity-60'>· Trial</span>}
    </span>
  )
}

export default PlanBadge
