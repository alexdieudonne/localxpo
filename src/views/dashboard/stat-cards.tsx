// Third-party Imports
import { ActivityIcon, CheckCircle2Icon, RadioIcon, TimerIcon } from 'lucide-react'

// Component Imports
import { Card, CardContent } from '@/components/ui/card'

// Lib Imports
import { formatDuration } from '@/lib/format'
import type { getBuildStats } from '@/lib/server/builds'

const StatCard = ({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) => (
  <Card size='sm'>
    <CardContent className='flex items-start justify-between gap-3'>
      <div className='space-y-1'>
        <p className='text-muted-foreground text-sm'>{label}</p>
        <p className='text-2xl font-semibold tabular-nums'>{value}</p>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </div>
      <div className='bg-primary/10 text-primary rounded-md p-2 [&_svg]:size-5'>{icon}</div>
    </CardContent>
  </Card>
)

const StatCards = ({ stats, period = 'last 30 days' }: { stats: Awaited<ReturnType<typeof getBuildStats>>; period?: string }) => {
  const finished = stats.success + stats.failed
  const rate = finished ? Math.round((stats.success / finished) * 100) : null

  return (
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      <StatCard label='Builds' value={String(stats.total)} hint={period} icon={<ActivityIcon />} />
      <StatCard
        label='Success rate'
        value={rate === null ? '—' : `${rate}%`}
        hint={`${stats.success} succeeded · ${stats.failed} failed`}
        icon={<CheckCircle2Icon />}
      />
      <StatCard label='Average build' value={formatDuration(stats.avgMs)} hint='successful builds' icon={<TimerIcon />} />
      <StatCard
        label='Running now'
        value={String(stats.running)}
        hint={stats.running ? 'live logs available' : 'nothing building'}
        icon={<RadioIcon />}
      />
    </div>
  )
}

export default StatCards
