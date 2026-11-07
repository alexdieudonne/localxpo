'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// Third-party Imports
import { AlertTriangleIcon, CheckCircle2Icon, CpuIcon, InfoIcon } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'

// Component Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Lib Imports
import type { Insight, MachineInfo, MetricsSummary, Sample } from '@/lib/metrics-types'
import { cliSendsMetrics } from '@/lib/cli-version'
import { cn } from '@/lib/utils'

type Data = {
  samples: Sample[]
  summary: MetricsSummary | null
  insights: Insight[]
  machine: { name: string; info: MachineInfo } | null
}

// Validated pair (dataviz validator, light + dark): the build is the one colored series; the whole machine is
// context, drawn as a soft neutral area behind it.
const BUILD = { light: '#f54900', dark: '#ec6100' }

const config = {
  machine: { label: 'Whole machine', color: 'var(--muted-foreground)' },
  build: { label: 'Build processes', theme: BUILD },
  power: { label: 'Power draw', theme: BUILD }
} satisfies ChartConfig

const GB = 1024 ** 3
const gb = (b: number | null | undefined, digits = 1) => (b === null || b === undefined ? '—' : `${(b / GB).toFixed(digits)} GB`)

/** Four even ticks up to the machine's RAM: 18 GB → 0, 6, 12, 18. */
const memTicks = (max: number) => [0, 1, 2, 3].map(i => Math.round((max * i) / 3))

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))

  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const duration = (ms: number) => {
  const s = Math.round(ms / 1000)

  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/** "MacBook Pro (Mac15,6) · Apple M3 Pro · 12 cores (8P + 4E) · 36 GB · macOS 15.1" */
const machineLine = (i: MachineInfo) =>
  [
    i.model,
    i.cpuModel,
    i.cores ? `${i.cores} cores${i.perfCores && i.effCores ? ` (${i.perfCores}P + ${i.effCores}E)` : ''}` : null,
    i.memTotal ? `${Math.round(i.memTotal / GB)} GB RAM` : null,
    i.os
  ].filter(Boolean)

const toolLine = (i: MachineInfo) =>
  [i.xcode && `Xcode ${i.xcode}`, i.java && `Java ${i.java}`, i.node && `Node ${i.node.replace(/^v/, '')}`, i.fastlane && `fastlane ${i.fastlane}`].filter(Boolean)

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warning' }) => (
  <div className='rounded-lg border px-3 py-2.5'>
    <p className='text-muted-foreground flex items-center gap-1 text-xs'>
      {label}
      {tone === 'warning' && <AlertTriangleIcon className='size-3.5 text-amber-600 dark:text-amber-400' aria-label='warning' />}
    </p>
    <p className='mt-0.5 text-lg font-semibold'>{value}</p>
    {sub && <p className='text-muted-foreground mt-0.5 text-xs'>{sub}</p>}
  </div>
)

const ICON = {
  good: <CheckCircle2Icon className='size-4 text-emerald-600 dark:text-emerald-400' />,
  info: <InfoIcon className='text-muted-foreground size-4' />,
  warning: <AlertTriangleIcon className='size-4 text-amber-600 dark:text-amber-400' />
}

type Point = { t: number; machine?: number; build?: number; power?: number }

/** One small chart per unit (CPU %, memory GB, power W), sharing the time axis: never two scales on one plot. */
const MiniChart = ({
  title,
  data,
  steps,
  unit,
  domain,
  series,
  ticks,
  showStepLabels
}: {
  title: string
  data: Point[]
  steps: { t: number; step: string }[]
  unit: string
  domain?: [number, number | 'auto']
  series: ('machine' | 'build' | 'power')[]
  ticks?: number[]
  showStepLabels?: boolean
}) => {
  const last = data[data.length - 1]?.t ?? 0

  return (
    <div>
      <p className='text-muted-foreground mb-1 text-xs font-medium'>{title}</p>
      <ChartContainer config={config} className='aspect-auto h-44 w-full'>
        <ComposedChart data={data} margin={{ left: 0, right: 12, top: showStepLabels ? 18 : 6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke='var(--border)' />
          <XAxis
            dataKey='t'
            type='number'
            domain={[0, last]}
            tickFormatter={clock}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={40}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            fontSize={11}
            domain={domain ?? [0, 'auto']}
            ticks={ticks}
            tickFormatter={v => `${Math.round(v)}${unit}`}
          />
          {steps.map((s, i) =>
            i === 0 ? null : (
              <ReferenceLine
                key={`${s.step}-${s.t}`}
                x={s.t}
                stroke='var(--border)'
                strokeWidth={1}
                label={
                  showStepLabels && (steps[i + 1]?.t ?? last) - s.t > last * 0.08
                    ? { value: s.step, position: 'insideTopLeft', fontSize: 10, fill: 'var(--muted-foreground)', dy: -14 }
                    : undefined
                }
              />
            )
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as (Point & { step?: string }) | undefined

                  return p ? `${clock(p.t)}${p.step ? ` · ${p.step}` : ''}` : ''
                }}
                formatter={(value, name) => (
                  <div className='flex w-full items-center justify-between gap-4'>
                    <span className='text-muted-foreground'>{config[name as keyof typeof config]?.label ?? name}</span>
                    <span className='font-mono font-medium tabular-nums'>
                      {Number(value).toFixed(unit === '%' ? 0 : 1)}
                      {unit}
                    </span>
                  </div>
                )}
              />
            }
          />
          {series.includes('machine') && (
            <Area dataKey='machine' type='monotone' stroke='none' fill='var(--color-machine)' fillOpacity={0.18} isAnimationActive={false} />
          )}
          {series.includes('build') && (
            <Line dataKey='build' type='monotone' stroke='var(--color-build)' strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          )}
          {series.includes('power') && (
            <Line dataKey='power' type='monotone' stroke='var(--color-power)' strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

const RunInsights = ({ kind, runId, running, cliVersion }: { kind: 'builds' | 'submissions'; runId: string; running: boolean; cliVersion?: string | null }) => {
  const oldCli = !cliSendsMetrics(cliVersion)

  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/${kind}/${runId}/metrics`, { cache: 'no-store' })

        if (res.ok && !stopped) setData((await res.json()) as Data)
      } catch {
        /* keep the last render */
      }

      if (!stopped && running) timer = setTimeout(load, 10_000)
    }

    load()

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [kind, runId, running])

  const chart = useMemo(() => {
    const samples = data?.samples ?? []
    const t0 = samples[0]?.ts ?? 0
    const points = samples.map(s => ({ t: s.ts - t0, step: s.step }))
    const steps: { t: number; step: string }[] = []

    for (const s of samples) if (s.step && steps[steps.length - 1]?.step !== s.step) steps.push({ t: s.ts - t0, step: s.step })

    return {
      steps,
      cpu: samples.map((s, i) => ({ ...points[i], machine: s.cpu, build: s.buildCpu })),
      mem: samples.map((s, i) => ({ ...points[i], machine: s.memUsed / GB, build: s.buildRss !== undefined ? s.buildRss / GB : undefined })),
      power: samples.some(s => s.powerMw !== undefined) ? samples.map((s, i) => ({ ...points[i], power: s.powerMw !== undefined ? s.powerMw / 1000 : undefined })) : null,
      memMax: Math.ceil(Math.max(...samples.map(s => s.memTotal), 0) / GB)
    }
  }, [data])

  if (!data || !data.summary || data.samples.length < 2) {
    if (!running) return null

    return (
      <Card size='sm'>
        <CardContent className='text-muted-foreground flex items-center gap-2 text-sm'>
          <CpuIcon className='size-4' /> {oldCli ? <>This build runs localxpo CLI v{cliVersion}, which doesn&apos;t send resource metrics. Start your next build with <code className='font-mono'>npx localxpo@latest</code> (0.3.0 or later).</> : 'Collecting CPU, memory and power samples from the build machine…'}
        </CardContent>
      </Card>
    )
  }

  const m = data.summary
  const info = data.machine?.info
  const swapGrowth = m.swapPeak !== null && m.swapStart !== null ? m.swapPeak - m.swapStart : null
  const memPct = m.memTotal ? Math.round((m.memPeak / m.memTotal) * 100) : 0
  const totalStepMs = m.steps.reduce((a, s) => a + s.durationMs, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <CpuIcon className='size-4' /> Machine & resources
        </CardTitle>
        <CardDescription>
          {info && machineLine(info).length ? machineLine(info).join(' · ') : (data.machine?.name ?? 'Build machine')}
          {info && toolLine(info).length ? <span className='block text-xs'>{toolLine(info).join(' · ')}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
          <Tile label='CPU (whole machine)' value={`${m.cpuAvg}% avg`} sub={`peak ${m.cpuPeak}%${m.buildCpuAvg !== null ? ` · build ${m.buildCpuAvg}% avg` : ''}`} />
          <Tile label='Memory peak' value={gb(m.memPeak)} sub={`${memPct}% of ${gb(m.memTotal, 0)}`} tone={memPct > 92 ? 'warning' : undefined} />
          <Tile label='Build processes peak' value={gb(m.buildRssPeak)} sub={m.topProcesses[0] ? `largest: ${m.topProcesses[0].name}` : undefined} />
          <Tile
            label='Swap'
            value={swapGrowth === null ? '—' : swapGrowth > 0.05 * GB ? `+${gb(swapGrowth)}` : 'none'}
            sub={m.swapPeak !== null ? `peak ${gb(m.swapPeak)} in use` : undefined}
            tone={swapGrowth !== null && swapGrowth > GB ? 'warning' : undefined}
          />
          <Tile
            label='Energy'
            value={m.energyWh !== null ? `${m.energyWh < 1 ? m.energyWh.toFixed(2) : m.energyWh.toFixed(1)} Wh` : '—'}
            sub={m.powerAvgW !== null ? `avg ${m.powerAvgW} W · peak ${m.powerPeakW} W` : 'not reported by this machine'}
          />
          <Tile
            label='Disk free'
            value={gb(m.diskFreeMin, 0)}
            sub={m.throttledShare > 0 ? `lowest during the run · CPU throttled ${Math.round(m.throttledShare * 100)}% of the time` : 'lowest during the run'}
            tone={m.diskFreeMin !== null && m.diskFreeMin < 15 * GB ? 'warning' : undefined}
          />
        </div>

        {data.insights.length > 0 && (
          <ul className='grid gap-3 lg:grid-cols-2'>
            {data.insights.map(i => (
              <li key={i.title} className='flex gap-2.5 rounded-lg border px-3 py-2.5'>
                <span className='mt-0.5 shrink-0'>{ICON[i.level]}</span>
                <span>
                  <span className='block text-sm font-medium'>{i.title}</span>
                  <span className='text-muted-foreground block text-xs'>{i.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className='space-y-2'>
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
            <span className='flex items-center gap-1.5'>
              <span className='h-0.5 w-4 rounded-full bg-[#f54900] dark:bg-[#ec6100]' /> Build processes
            </span>
            <span className='flex items-center gap-1.5'>
              <span className='bg-muted-foreground/25 h-2.5 w-4 rounded-sm' /> Whole machine
            </span>
            <span className='flex items-center gap-1.5'>
              <span className='bg-border h-3 w-px' /> Step boundary
            </span>
          </div>
        <div className={cn('grid gap-6', chart.power ? 'xl:grid-cols-3' : 'xl:grid-cols-2')}>
          <MiniChart title='CPU' data={chart.cpu} steps={chart.steps} unit='%' domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} series={['machine', 'build']} showStepLabels />
          <MiniChart
            title='Memory'
            data={chart.mem}
            steps={chart.steps}
            unit=' GB'
            domain={[0, chart.memMax || 'auto']}
            ticks={chart.memMax ? memTicks(chart.memMax) : undefined}
            series={['machine', 'build']}
          />
          {chart.power && <MiniChart title='Power draw (whole machine)' data={chart.power} steps={chart.steps} unit=' W' series={['power']} />}
        </div>
        </div>

        <div className='grid gap-6 xl:grid-cols-2'>
          <div>
            <p className='mb-2 text-sm font-medium'>Time by step</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className='text-right'>Time</TableHead>
                  <TableHead className='w-40'>Share</TableHead>
                  <TableHead className='text-right'>CPU avg</TableHead>
                  <TableHead className='text-right'>Build RAM peak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.steps
                  .filter(s => s.durationMs > 0)
                  .map(s => (
                    <TableRow key={s.step}>
                      <TableCell className='font-medium'>{s.step}</TableCell>
                      <TableCell className='text-right tabular-nums'>{duration(s.durationMs)}</TableCell>
                      <TableCell>
                        <div className='bg-muted h-1.5 w-full overflow-hidden rounded-full'>
                          <div className='h-full rounded-full bg-[#f54900] dark:bg-[#ec6100]' style={{ width: `${Math.max((s.durationMs / (totalStepMs || 1)) * 100, 2)}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>{s.cpuAvg}%</TableCell>
                      <TableCell className='text-right tabular-nums'>{s.buildRssPeak ? gb(s.buildRssPeak) : '—'}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <p className='mb-2 text-sm font-medium'>Heaviest processes</p>
            {m.topProcesses.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process</TableHead>
                    <TableHead className='text-right'>Memory peak</TableHead>
                    <TableHead className='text-right'>CPU avg (of machine)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.topProcesses.map(p => (
                    <TableRow key={p.name}>
                      <TableCell className='font-medium'>{p.name}</TableCell>
                      <TableCell className='text-right tabular-nums'>{gb(p.rssPeak)}</TableCell>
                      <TableCell className='text-right tabular-nums'>{p.cpuAvg}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className='text-muted-foreground text-sm'>No build processes recorded.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default RunInsights
