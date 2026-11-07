'use client'

// React Imports
import { useEffect, useState } from 'react'

// Third-party Imports
import { AlertTriangleIcon, CheckCircle2Icon, GaugeIcon, SlidersHorizontalIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import LimitsForm from '@/views/machines/limits-form'

// Lib Imports
import { describeLimits, mergeLimits, type BuildLimits, type MachineCapacity } from '@/lib/limits-types'
import type { MetricsSummary, Sample } from '@/lib/metrics-types'
import { cliSendsMetrics } from '@/lib/cli-version'
import { cn } from '@/lib/utils'

const GB = 1024 ** 3
const gb = (b: number | null | undefined, d = 1) => (b === null || b === undefined ? '—' : `${(b / GB).toFixed(d)}`)

export type LimitTarget = {
  orgSlug: string
  machine: string
  own: BuildLimits | null
  orgDefault: BuildLimits | null
  capacity: MachineCapacity | null
  capacityLabel?: string
}

type Pressure = { level: 'normal' | 'elevated' | 'high'; detail: string }

/** Memory pressure from the last couple of minutes: how full RAM is and whether swap is growing. */
const pressureOf = (samples: Sample[]): Pressure | null => {
  const last = samples[samples.length - 1]

  if (!last) return null

  const pct = last.memTotal ? last.memUsed / last.memTotal : 0
  const ref = samples.find(s => s.ts >= last.ts - 120_000) ?? samples[0]
  const swapDelta = last.swapUsed !== undefined && ref.swapUsed !== undefined ? last.swapUsed - ref.swapUsed : 0
  const swapText = swapDelta > 0.05 * GB ? `swap +${gb(swapDelta)} GB in 2 min` : last.swapUsed ? `${gb(last.swapUsed)} GB in swap, stable` : 'no swap'

  if (pct >= 0.92 || swapDelta > 0.5 * GB) return { level: 'high', detail: swapText }
  if (pct >= 0.8 || swapDelta > 0.1 * GB) return { level: 'elevated', detail: swapText }

  return { level: 'normal', detail: swapText }
}

/** Tiny line of the last minutes (no axes: the tile's number is the reading). */
const Spark = ({ values, max }: { values: number[]; max: number }) => {
  if (values.length < 2 || !max) return null

  const w = 120
  const h = 24
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (Math.min(v, max) / max) * (h - 4)).toFixed(1)}`)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className='mt-1 h-6 w-full' preserveAspectRatio='none' aria-hidden>
      <polyline points={pts.join(' ')} fill='none' className='stroke-[#f54900] dark:stroke-[#ec6100]' strokeWidth={1.5} vectorEffect='non-scaling-stroke' />
    </svg>
  )
}

const Tile = ({ label, value, sub, children, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; tone?: 'warning' | 'danger' }) => (
  <div className='min-w-0 rounded-lg border px-3 py-2'>
    <p className='text-muted-foreground flex items-center gap-1 text-xs'>
      {label}
      {tone === 'warning' && <AlertTriangleIcon className='size-3.5 text-amber-600 dark:text-amber-400' aria-label='warning' />}
      {tone === 'danger' && <AlertTriangleIcon className='size-3.5 text-red-600 dark:text-red-400' aria-label='alert' />}
    </p>
    <p className='truncate text-base font-semibold'>{value}</p>
    {sub && <p className='text-muted-foreground truncate text-xs'>{sub}</p>}
    {children}
  </div>
)

const PRESSURE = {
  normal: { label: 'Normal', className: 'text-emerald-700 dark:text-emerald-400', icon: <CheckCircle2Icon className='size-4' /> },
  elevated: { label: 'Elevated', className: 'text-amber-700 dark:text-amber-400', icon: <AlertTriangleIcon className='size-4' /> },
  high: { label: 'High', className: 'text-red-700 dark:text-red-400', icon: <AlertTriangleIcon className='size-4' /> }
}

/**
 * Live machine usage above the build logs: memory and its pressure, CPU, the build's own processes, power and
 * disk, refreshed every 5 s while the build runs (peaks once it's done), plus a shortcut to limit this machine.
 */
const LiveResources = ({
  kind,
  runId,
  running,
  target,
  cliVersion
}: {
  kind: 'builds' | 'submissions'
  runId: string
  running: boolean
  target?: LimitTarget | null
  cliVersion?: string | null
}) => {
  const oldCli = !cliSendsMetrics(cliVersion)

  const [samples, setSamples] = useState<Sample[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [updated, setUpdated] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/${kind}/${runId}/metrics?tail=72`, { cache: 'no-store' })

        if (res.ok && !stopped) {
          const data = (await res.json()) as { samples: Sample[]; summary: MetricsSummary | null }

          setSamples(data.samples)
          setSummary(data.summary)
          setUpdated(Date.now())
        }
      } catch {
        /* keep the last values */
      }

      if (!stopped && running) timer = setTimeout(load, 5000)
    }

    load()

    const tick = running ? setInterval(() => setNow(Date.now()), 1000) : undefined

    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(tick)
    }
  }, [kind, runId, running])

  const last = samples[samples.length - 1]

  if (!last) {
    return running ? (
      <Card size='sm'>
        <CardContent className='text-muted-foreground flex items-center gap-2 text-sm'>
          <GaugeIcon className='size-4' /> {oldCli ? <>This build runs localxpo CLI v{cliVersion}, which doesn&apos;t send resource metrics. Start your next build with <code className='font-mono'>npx localxpo@latest</code> (0.3.0 or later).</> : 'Waiting for the first resource sample from the build machine…'}
        </CardContent>
      </Card>
    ) : null
  }

  const live = running
  const pressure = pressureOf(samples)
  const memPct = Math.round(((live ? last.memUsed : (summary?.memPeak ?? last.memUsed)) / last.memTotal) * 100)
  const top = live ? last.top?.[0] : summary?.topProcesses[0] ? { name: summary.topProcesses[0].name, rss: summary.topProcesses[0].rssPeak } : undefined
  const effective = target ? mergeLimits(target.orgDefault, target.own) : null
  const limitText = effective ? describeLimits(effective) : []
  const ago = updated ? Math.max(0, Math.round((now - updated) / 1000)) : null
  const p = pressure ? PRESSURE[pressure.level] : null

  return (
    <Card size='sm'>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='flex items-center gap-2 text-sm font-medium'>
            <GaugeIcon className='size-4' /> {live ? 'Machine right now' : 'Machine during this build (peaks)'}
            {live && ago !== null && <span className='text-muted-foreground text-xs font-normal'>updated {ago}s ago</span>}
          </p>
          {target && (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-xs'>{limitText.length ? `Limits: ${limitText.join(' · ')}` : 'No limits on this machine'}</span>
              <Dialog>
                <DialogTrigger render={<Button size='sm' variant={pressure?.level === 'high' ? 'default' : 'outline'} />}>
                  <SlidersHorizontalIcon /> Limit this machine
                </DialogTrigger>
                <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                  <DialogHeader>
                    <DialogTitle>Resource limits · {target.machine}</DialogTitle>
                    <DialogDescription>
                      Memory and worker limits apply from the next build on this machine. Low CPU priority also applies to this build within about 30
                      seconds.
                    </DialogDescription>
                  </DialogHeader>
                  <LimitsForm
                    orgSlug={target.orgSlug}
                    machine={target.machine}
                    initial={target.own}
                    inherited={target.orgDefault}
                    capacity={target.capacity}
                    capacityLabel={target.capacityLabel}
                    canEdit
                  />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className='grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6'>
          <Tile
            label={live ? 'Memory used' : 'Memory peak'}
            value={`${gb(live ? last.memUsed : summary?.memPeak)} / ${gb(last.memTotal, 0)} GB`}
            sub={`${memPct}% of RAM`}
            tone={memPct >= 92 ? 'danger' : memPct >= 80 ? 'warning' : undefined}
          >
            <Spark values={samples.map(s => s.memUsed)} max={last.memTotal} />
          </Tile>
          <Tile label='Memory pressure' value={p ? <span className={cn('flex items-center gap-1', p.className)}>{p.icon} {p.label}</span> : '—'} sub={pressure?.detail} />
          <Tile label={live ? 'CPU' : 'CPU average'} value={`${Math.round(live ? last.cpu : (summary?.cpuAvg ?? last.cpu))}%`} sub={last.buildCpu !== undefined ? `build ${Math.round(live ? last.buildCpu : (summary?.buildCpuAvg ?? 0))}% · load ${last.load1 !== undefined ? last.load1.toFixed(1) : '—'}` : undefined}>
            <Spark values={samples.map(s => s.cpu)} max={100} />
          </Tile>
          <Tile
            label={live ? 'Build processes' : 'Build processes peak'}
            value={`${gb(live ? last.buildRss : summary?.buildRssPeak)} GB`}
            sub={top ? `${last.buildProcs ?? '?'} processes · ${top.name} ${gb(top.rss)} GB` : `${last.buildProcs ?? 0} processes`}
          >
            <Spark values={samples.map(s => s.buildRss ?? 0)} max={last.memTotal} />
          </Tile>
          <Tile
            label='Power'
            value={last.powerMw !== undefined ? `${(last.powerMw / 1000).toFixed(0)} W` : '—'}
            sub={
              last.powerMw === undefined
                ? 'not reported by this machine'
                : `${last.onBattery ? `on battery${last.batteryPct !== undefined ? ` · ${last.batteryPct}%` : ''}` : 'plugged in'}${summary?.energyWh ? ` · ${summary.energyWh} Wh so far` : ''}`
            }
            tone={last.onBattery && (last.batteryPct ?? 100) < 20 ? 'warning' : undefined}
          />
          <Tile
            label='Disk free'
            value={`${gb(last.diskFree, 0)} GB`}
            sub={last.cpuLimit !== undefined && last.cpuLimit < 100 ? `CPU throttled to ${last.cpuLimit}%` : last.step ? `step: ${last.step}` : undefined}
            tone={last.diskFree !== undefined && last.diskFree < 15 * GB ? 'warning' : last.cpuLimit !== undefined && last.cpuLimit < 100 ? 'warning' : undefined}
          />
        </div>

        {pressure?.level === 'high' && live && (
          <p className='flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300'>
            <AlertTriangleIcon className='mt-px size-3.5 shrink-0' />
            The machine is short on memory, so this build will slow down. Close heavy apps now; to prevent it, limit Gradle memory or the parallel
            workers for this machine.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default LiveResources
