// Third-party Imports
import { AlertTriangleIcon, BatteryChargingIcon, ChevronRightIcon, CpuIcon, GaugeIcon, LaptopIcon, MonitorIcon, ThermometerIcon, ZapIcon } from 'lucide-react'

// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import CodeBlock from '@/components/shared/CodeBlock'
import { AgentBadge, AgentStatusProvider, OnlineSummary } from '@/views/machines/agent-status'
import LimitsForm from '@/views/machines/limits-form'
import PlanUsage from '@/views/billing/plan-usage'

// Lib Imports
import { formatDuration, timeAgo } from '@/lib/format'
import { capacityLabel, capacityOf, smallestMachine } from '@/lib/capacity'
import { describeLimits, mergeLimits } from '@/lib/limits-types'
import { listAgentsForOrg } from '@/lib/server/jobs'
import { getOrgDefaultLimits, listMachineLimits } from '@/lib/server/limits'
import { listMachines, type MachineInfo, type MachineStats } from '@/lib/server/metrics'
import { requireOrg } from '@/lib/server/orgs'

export const metadata = { title: 'Machines' }
export const dynamic = 'force-dynamic'

const GB = 1024 ** 3

const specs = (i: MachineInfo) =>
  [
    i.model,
    i.cpuModel,
    i.cores ? `${i.cores} cores${i.perfCores && i.effCores ? ` (${i.perfCores}P + ${i.effCores}E)` : ''}` : null,
    i.memTotal ? `${Math.round(i.memTotal / GB)} GB RAM` : null,
    i.diskTotal ? `${Math.round(i.diskTotal / GB)} GB disk` : null,
    i.os
  ].filter(Boolean)

const tools = (i: MachineInfo) =>
  [i.xcode && `Xcode ${i.xcode}`, i.java && `Java ${i.java}`, i.node && `Node ${i.node.replace(/^v/, '')}`, i.fastlane && `fastlane ${i.fastlane}`].filter(Boolean)

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div>
    <p className='text-muted-foreground text-xs'>{label}</p>
    <p className='text-base font-semibold'>{value}</p>
    {sub && <p className='text-muted-foreground text-xs'>{sub}</p>}
  </div>
)

/** "Fastest for Android: X, median 6m vs 9m on Y" when at least two machines built that platform. */
const fastest = (machines: MachineStats[], key: 'medianAndroidMs' | 'medianIosMs') => {
  const ranked = machines.filter(m => m[key] !== null).sort((a, b) => a[key]! - b[key]!)

  if (ranked.length < 2) return null

  const [first, ...rest] = ranked
  const slowest = rest[rest.length - 1]

  return { first, slowest, ratio: slowest[key]! / first[key]!, key }
}

const Fold = ({ title, summary, children, open }: { title: string; summary: string; children: React.ReactNode; open?: boolean }) => (
  <details className='group rounded-lg border' open={open}>
    <summary className='hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden'>
      <ChevronRightIcon className='text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90' />
      <GaugeIcon className='text-muted-foreground size-4 shrink-0' />
      <span className='font-medium'>{title}</span>
      <span className='text-muted-foreground min-w-0 truncate text-xs'>{summary}</span>
    </summary>
    <div className='border-t px-3 pt-4 pb-3'>{children}</div>
  </details>
)

const MachinesPage = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { org } = await requireOrg((await params).org)
  const agents = await listAgentsForOrg(org.id)
  const built = await listMachines(org.id, 30)

  // A machine whose agent is connected but that hasn't built yet still gets a card.
  const machines: MachineStats[] = [
    ...built,
    ...agents
      .filter(a => !built.some(m => m.name === a.machine))
      .map(a => ({
        name: a.machine,
        info: {},
        firstSeen: a.started_at,
        lastSeen: null,
        builds: 0,
        succeeded: 0,
        failed: 0,
        medianAndroidMs: null,
        medianIosMs: null,
        avgCpu: null,
        avgMemPeakPct: null,
        avgEnergyWh: null,
        totalEnergyWh: null,
        throttledBuilds: 0,
        swappingBuilds: 0,
        gradlePeak: null,
        buildRssPeak: null
      }))
  ]

  const orgLimits = await getOrgDefaultLimits(org.id)
  const machineLimits = await listMachineLimits(org.id)
  const smallest = smallestMachine(machines)
  const highlights = [fastest(machines, 'medianAndroidMs'), fastest(machines, 'medianIosMs')].filter(Boolean)
  const totalEnergy = machines.reduce((a, m) => a + (m.totalEnergyWh ?? 0), 0)
  const totalBuilds = machines.reduce((a, m) => a + m.builds, 0)

  // Server time for the badges' first render (an async server component runs once per request).
  const renderedAt = Number(new Date())

  const live = agents.map(a => ({
    machine: a.machine,
    online: a.online,
    busy: Boolean(a.busy_job_id),
    lastSeen: a.last_seen,
    version: a.version,
    platforms: a.platforms,
    projects: a.projects.length
  }))

  return (
    <AgentStatusProvider orgSlug={org.slug} initial={live} serverNow={renderedAt}>
    <div className='space-y-6'>
      <PageHeader
        title='Machines'
        description='The computers your team builds on, with how they performed over the last 30 days.'
        actions={<PlanUsage org={org} kind='machines' />}
      />

      {machines.length === 0 ? (
        <Card>
          <CardContent className='text-muted-foreground py-10 text-center text-sm'>
            No machines yet. A machine appears here once it runs `npx localxpo agent` or its first `npx localxpo build`.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <Card size='sm'>
              <CardContent>
                <Stat label='Machines' value={String(machines.length)} sub={`${totalBuilds} builds in 30 days`} />
              </CardContent>
            </Card>
            <Card size='sm'>
              <CardContent>
                <Stat
                  label='Energy used by builds'
                  value={totalEnergy ? `${totalEnergy < 1000 ? totalEnergy.toFixed(1) : (totalEnergy / 1000).toFixed(2)} ${totalEnergy < 1000 ? 'Wh' : 'kWh'}` : '—'}
                  sub={totalEnergy ? 'measured on laptops that report power draw' : 'no machine reported power draw yet'}
                />
              </CardContent>
            </Card>
            {highlights.map(h => (
              <Card size='sm' key={h!.key}>
                <CardContent>
                  <Stat
                    label={`Fastest for ${h!.key === 'medianIosMs' ? 'iOS' : 'Android'}`}
                    value={h!.first.name}
                    sub={`median ${formatDuration(h!.first[h!.key])}, ${h!.ratio.toFixed(1)}× faster than ${h!.slowest.name} (${formatDuration(h!.slowest[h!.key])})`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card size='sm'>
            <CardContent className='grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center'>
              <div>
                <p className='font-medium'>Build from the dashboard</p>
                <p className='text-muted-foreground text-sm'>
                  Run the agent in a project folder on each machine that should build. It stays connected, picks up the builds and uploads you start
                  here (New build, Rebuild, Submit), and stops them when you press Cancel. Add more projects with <code className='font-mono'>--dir</code>.
                </p>
              </div>
              <div className='space-y-2'>
                <CodeBlock code='npx localxpo agent' />
                <p className='text-muted-foreground text-xs'>
                  <OnlineSummary />
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size='sm'>
            <CardContent>
              <Fold
                title='Default resource limits'
                summary={describeLimits(orgLimits ?? {}).join(' · ') || 'none: builds use the whole machine'}
              >
                <p className='text-muted-foreground mb-4 text-xs'>
                  Applied by the CLI on every machine, unless the machine sets its own below. Empty fields leave the project’s own settings
                  (gradle.properties, Xcode) alone.
                </p>
                <LimitsForm
                  orgSlug={org.slug}
                  machine=''
                  initial={orgLimits}
                  capacity={smallest ? capacityOf(smallest) : null}
                  capacityLabel={smallest ? capacityLabel(smallest, `Checked against your smallest machine, ${smallest.name}`) : undefined}
                  canEdit
                />
              </Fold>
            </CardContent>
          </Card>

          <div className='grid gap-6 lg:grid-cols-2'>
            {machines.map(m => {
              const rate = m.succeeded + m.failed ? Math.round((m.succeeded / (m.succeeded + m.failed)) * 100) : null
              const own = machineLimits.get(m.name) ?? null
              const effective = describeLimits(mergeLimits(orgLimits, own))

              return (
                <Card key={m.name}>
                  <CardHeader>
                    <CardTitle className='flex flex-wrap items-center gap-2'>
                      {m.info.powerSource === 'battery' ? <LaptopIcon className='size-4' /> : <MonitorIcon className='size-4' />} {m.name}
                      <AgentBadge machine={m.name} />
                    </CardTitle>
                    <CardDescription>
                      {specs(m.info).length ? specs(m.info).join(' · ') : 'Specs appear after its next build with localxpo 0.3 or later.'}
                      {tools(m.info).length ? <span className='block text-xs'>{tools(m.info).join(' · ')}</span> : null}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
                      <Stat label='Builds (30 days)' value={String(m.builds)} sub={rate !== null ? `${rate}% succeeded` : undefined} />
                      <Stat label='Median Android build' value={m.medianAndroidMs ? formatDuration(m.medianAndroidMs) : '—'} />
                      <Stat label='Median iOS build' value={m.medianIosMs ? formatDuration(m.medianIosMs) : '—'} />
                      <Stat label='CPU during builds' value={m.avgCpu !== null ? `${m.avgCpu}% avg` : '—'} />
                      <Stat label='Memory peak' value={m.avgMemPeakPct !== null ? `${m.avgMemPeakPct}% avg` : '—'} sub='of its RAM, per build' />
                      <Stat
                        label='Energy per build'
                        value={m.avgEnergyWh !== null ? `${m.avgEnergyWh} Wh` : '—'}
                        sub={m.info.powerSource === 'none' ? 'no power telemetry (desktop)' : undefined}
                      />
                    </div>
                    <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                      <span className='flex items-center gap-1'>
                        <CpuIcon className='size-3.5' /> {m.lastSeen ? `last build ${timeAgo(m.lastSeen)}` : 'no build yet'}
                      </span>
                      {m.info.powerSource === 'battery' && (
                        <span className='flex items-center gap-1'>
                          <BatteryChargingIcon className='size-3.5' /> laptop
                        </span>
                      )}
                      {m.avgEnergyWh !== null && (
                        <span className='flex items-center gap-1'>
                          <ZapIcon className='size-3.5' /> {m.totalEnergyWh} Wh in 30 days
                        </span>
                      )}
                      {m.swappingBuilds > 0 && (
                        <span className='flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                          <AlertTriangleIcon className='size-3.5' /> ran out of RAM (swapped &gt;1 GB) in {m.swappingBuilds} build{m.swappingBuilds > 1 ? 's' : ''}
                        </span>
                      )}
                      {m.throttledBuilds > 0 && (
                        <span className='flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                          <ThermometerIcon className='size-3.5' /> throttled by heat in {m.throttledBuilds} build{m.throttledBuilds > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <Fold
                      title='Resource limits'
                      summary={effective.length ? `${effective.join(' · ')}${own ? '' : ' (default)'}` : 'none'}
                    >
                      <LimitsForm
                        orgSlug={org.slug}
                        machine={m.name}
                        initial={own}
                        inherited={orgLimits}
                        capacity={m.info.memTotal || m.info.cores ? capacityOf(m) : null}
                        capacityLabel={capacityLabel(m)}
                        canEdit
                      />
                    </Fold>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
    </AgentStatusProvider>
  )
}

export default MachinesPage
