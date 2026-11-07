// Third-party Imports
import { LightbulbIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge } from '@/components/builds/badges'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import BuildsChart from '@/views/dashboard/builds-chart'
import StatCards from '@/views/dashboard/stat-cards'
import DurationChart from '@/views/insights/duration-chart'

// Lib Imports
import { formatDuration } from '@/lib/format'
import { getBuildStats, getProjectInsights } from '@/lib/server/builds'
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Insights' }
export const dynamic = 'force-dynamic'

const Bar = ({ value, max, className }: { value: number; max: number; className?: string }) => (
  <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
    <div className={className ?? 'bg-primary h-full rounded-full'} style={{ width: `${max ? Math.max((value / max) * 100, 2) : 0}%` }} />
  </div>
)

const InsightsPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { org, project } = await requireProject(p.org, p.project)
  const stats = await getBuildStats({ orgId: org.id, projectId: project.id }, 30)
  const insights = await getProjectInsights(project.id, 30)
  const maxCause = Math.max(...insights.topCauses.map(c => c.count), 0)
  const maxStep = Math.max(...insights.failingSteps.map(s => s.failures), 0)
  const maxMachine = Math.max(...insights.machines.map(m => m.total), 0)

  return (
    <div className='space-y-6'>
      <PageHeader title='Insights' description={`How ${project.name} builds have gone over the last 30 days.`} />

      <StatCards stats={stats} />

      {stats.total === 0 ? (
        <Card>
          <CardContent className='text-muted-foreground py-10 text-center text-sm'>No builds in the last 30 days.</CardContent>
        </Card>
      ) : (
        <>
          <div className='grid gap-6 xl:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Builds per day</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <BuildsChart days={stats.days} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Build duration</CardTitle>
                <CardDescription>Successful builds, oldest to newest</CardDescription>
              </CardHeader>
              <CardContent>
                <DurationChart points={insights.durations.map(d => ({ label: `#${d.number}`, platform: d.platform, minutes: d.ms / 60000 }))} />
              </CardContent>
            </Card>
          </div>

          <div className='grid gap-6 lg:grid-cols-2 xl:grid-cols-3'>
            <Card>
              <CardHeader>
                <CardTitle>By platform</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {insights.perPlatform.map(pl => {
                  const finished = pl.success + pl.failed

                  return (
                    <div key={pl.platform} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <PlatformBadge platform={pl.platform} />
                        <span className='text-sm tabular-nums'>{finished ? Math.round((pl.success / finished) * 100) : 0}% success</span>
                      </div>
                      <Bar value={pl.success} max={finished} className='h-full rounded-full bg-emerald-500' />
                      <dl className='text-muted-foreground grid grid-cols-3 gap-2 text-xs'>
                        <div>
                          <dt>Builds</dt>
                          <dd className='text-foreground font-medium tabular-nums'>{pl.total}</dd>
                        </div>
                        <div>
                          <dt>Average</dt>
                          <dd className='text-foreground font-medium tabular-nums'>{formatDuration(pl.avg_ms)}</dd>
                        </div>
                        <div>
                          <dt>Fastest</dt>
                          <dd className='text-foreground font-medium tabular-nums'>{formatDuration(pl.min_ms)}</dd>
                        </div>
                      </dl>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most common failure causes</CardTitle>
                <CardDescription>From the errors recognized in failed builds</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {insights.topCauses.length === 0 && <p className='text-muted-foreground text-sm'>No recognized causes yet.</p>}
                {insights.topCauses.map(c => (
                  <div key={c.id} className='space-y-1.5'>
                    <div className='flex justify-between gap-3 text-sm'>
                      <span className='font-medium'>{c.title}</span>
                      <span className='text-muted-foreground tabular-nums'>{c.count}×</span>
                    </div>
                    <Bar value={c.count} max={maxCause} className='bg-destructive/80 h-full rounded-full' />
                  </div>
                ))}
                {insights.topCauses[0] && (
                  <p className='text-muted-foreground flex gap-2 pt-2 text-sm'>
                    <LightbulbIcon className='mt-0.5 size-4 shrink-0 text-amber-500' />
                    {insights.topCauses[0].fix}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Where builds fail</CardTitle>
                <CardDescription>Failed steps, and builds per machine</CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='space-y-3'>
                  {insights.failingSteps.length === 0 && <p className='text-muted-foreground text-sm'>No failed steps.</p>}
                  {insights.failingSteps.map(s => (
                    <div key={s.name} className='space-y-1.5'>
                      <div className='flex justify-between text-sm'>
                        <span>{s.name}</span>
                        <span className='text-muted-foreground tabular-nums'>{s.failures}</span>
                      </div>
                      <Bar value={s.failures} max={maxStep} className='bg-destructive/60 h-full rounded-full' />
                    </div>
                  ))}
                </div>
                <div className='space-y-3 border-t pt-4'>
                  {insights.machines.map(m => (
                    <div key={m.machine} className='space-y-1.5'>
                      <div className='flex justify-between gap-3 text-sm'>
                        <span className='truncate'>{m.machine}</span>
                        <span className='text-muted-foreground shrink-0 tabular-nums'>
                          {m.success}/{m.total} ok
                        </span>
                      </div>
                      <Bar value={m.total} max={maxMachine} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default InsightsPage
