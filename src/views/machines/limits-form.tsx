'use client'

// React Imports
import { useMemo, useState } from 'react'

// Third-party Imports
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, Loader2Icon, WandSparklesIcon, XCircleIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { saveLimitsAction } from '@/lib/actions/limits'
import {
  checkLimits,
  describeLimits,
  mergeLimits,
  recommendLimits,
  type BuildLimits,
  type LimitCheck,
  type LimitField,
  type MachineCapacity
} from '@/lib/limits-types'
import { cn } from '@/lib/utils'

const GB = 1024 ** 3

type Choice<T> = { value: T; label: string }

/** Small segmented control (tri-state: inherit / on / off). */
const Segmented = <T,>({ value, options, onChange, label }: { value: T; options: Choice<T>[]; onChange: (v: T) => void; label: string }) => (
  <div role='group' aria-label={label} className='bg-muted inline-flex rounded-md p-0.5'>
    {options.map(o => (
      <button
        key={String(o.value)}
        type='button'
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
        className={cn(
          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
          o.value === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const CHECK_ICON = {
  error: <XCircleIcon className='size-3.5 shrink-0 text-red-600 dark:text-red-400' aria-label='error' />,
  warning: <AlertTriangleIcon className='size-3.5 shrink-0 text-amber-600 dark:text-amber-400' aria-label='warning' />,
  info: <InfoIcon className='text-muted-foreground size-3.5 shrink-0' aria-label='note' />,
  good: <CheckCircle2Icon className='size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400' aria-label='ok' />
}

const Checks = ({ checks }: { checks: LimitCheck[] }) =>
  checks.length ? (
    <ul className='space-y-1'>
      {checks.map(c => (
        <li key={c.message} className={cn('flex items-start gap-1.5 text-xs', c.level === 'error' ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
          <span className='mt-px'>{CHECK_ICON[c.level]}</span>
          {c.message}
        </li>
      ))}
    </ul>
  ) : null

const Row = ({
  title,
  hint,
  control,
  children
}: {
  title: string
  hint: string
  control: React.ReactNode
  children?: React.ReactNode
}) => (
  <div className='space-y-2'>
    <div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2'>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </div>
      {control}
    </div>
    {children}
  </div>
)

/** "Recommended 6 GB · range 3–9 GB · about a third of 18 GB RAM  [Use]" */
const Recommended = ({ value, unit, range, why, onUse }: { value: number | string | null | undefined; unit?: string; range?: [number, number] | null; why?: string; onUse?: () => void }) =>
  value === null || value === undefined ? null : (
    <p className='text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs'>
      <span>
        Recommended <b className='text-foreground font-medium'>{`${value}${unit ?? ''}`}</b>
        {range ? ` · sensible range ${range[0]}–${range[1]}${unit ?? ''}` : ''}
        {why ? ` · ${why}` : ''}
      </span>
      {onUse && (
        <button type='button' onClick={onUse} className='text-foreground underline-offset-2 hover:underline'>
          Use
        </button>
      )}
    </p>
  )

/** The machine's RAM, with what the Gradle and Kotlin daemons would take and the recommended band. */
const MemoryBar = ({ ram, heap, range }: { ram: number; heap: number | null; range: [number, number] | null }) => {
  const kotlin = heap ? Math.max(1, Math.round(heap / 2)) : 0
  const pct = (gb: number) => Math.min(100, (gb / ram) * 100)
  const over = heap !== null && heap + kotlin > ram - 2

  // Recommended band, as Gradle + Kotlin (1.5x the heap) on the RAM scale.
  const band = range ? { left: pct(range[0] * 1.5), width: pct(range[1] * 1.5) - pct(range[0] * 1.5) } : null

  return (
    <div className='space-y-1'>
      <div
        className='bg-muted relative flex h-3 w-full overflow-hidden rounded-full'
        role='img'
        aria-label={`Gradle ${heap ?? 'default'} GB and Kotlin ${kotlin} GB out of ${ram} GB RAM`}
      >
        {heap !== null && (
          <>
            <div className={cn(over ? 'bg-red-500' : 'bg-[#f54900] dark:bg-[#ec6100]')} style={{ width: `${pct(heap)}%` }} />
            <div
              className={cn('border-background border-l-2', over ? 'bg-red-500/60' : 'bg-[#f54900]/50 dark:bg-[#ec6100]/50')}
              style={{ width: `${pct(kotlin)}%` }}
            />
          </>
        )}
        {band && (
          <div
            className='absolute inset-y-0 border-x-2 border-emerald-600 dark:border-emerald-400'
            style={{ left: `${band.left}%`, width: `${band.width}%` }}
            title='Recommended range'
          />
        )}
      </div>
      <div className='text-muted-foreground flex flex-wrap justify-between gap-x-3 text-[11px]'>
        <span>{heap ? `Gradle ${heap} GB + Kotlin ${kotlin} GB = ${heap + kotlin} GB` : 'Gradle uses the project’s own setting'}</span>
        <span>
          {ram} GB RAM{heap ? ` · ${Math.max(0, ram - heap - kotlin)} GB left for Metro, Xcode and the system` : ''}
          {band ? ' · green marks: recommended' : ''}
        </span>
      </div>
    </div>
  )
}

/** One cell per core: performance cores first, then efficiency cores; the first N are lit. */
const CoreCells = ({ cores, perf, workers }: { cores: number; perf?: number; workers: number | null }) => {
  const p = perf ?? cores
  const lit = workers ?? cores

  return (
    <div className='space-y-1'>
      <div className='flex flex-wrap gap-1' role='img' aria-label={`${lit} of ${cores} cores used`}>
        {Array.from({ length: cores }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-sm border',
              i < lit ? (i < p ? 'border-transparent bg-[#f54900] dark:bg-[#ec6100]' : 'border-transparent bg-[#f54900]/45 dark:bg-[#ec6100]/45') : 'bg-muted border-border',
              i === p && p < cores && 'ml-1.5'
            )}
          />
        ))}
      </div>
      <p className='text-muted-foreground text-[11px]'>
        {perf && perf < cores ? `${perf} performance + ${cores - perf} efficiency cores` : `${cores} cores`}
        {workers ? ` · ${Math.min(workers, cores)} in use${workers > cores ? ` (+${workers - cores} beyond the cores)` : ''}` : ' · all in use'}
      </p>
    </div>
  )
}

const num = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)))

/**
 * Edits the resource limits of one machine (or the organization default when machine is '').
 * Empty fields inherit: a machine falls back to the default, the default to the build's own settings.
 * `capacity` is the machine (or, for the default, the smallest machine) the values are checked against.
 */
const LimitsForm = ({
  orgSlug,
  machine,
  initial,
  inherited,
  capacity,
  capacityLabel,
  canEdit
}: {
  orgSlug: string
  machine: string
  initial: BuildLimits | null
  inherited?: BuildLimits | null
  capacity?: MachineCapacity | null
  capacityLabel?: string
  canEdit: boolean
}) => {
  const [heap, setHeap] = useState(initial?.gradleHeapGb ? String(initial.gradleHeapGb) : '')
  const [workers, setWorkers] = useState(initial?.maxWorkers ? String(initial.maxWorkers) : '')
  const [priority, setPriority] = useState<BuildLimits['priority']>(initial?.priority ?? null)
  const [stop, setStop] = useState<boolean | null>(initial?.stopDaemons ?? null)
  const { run, pending } = useActionToast()

  const current: BuildLimits = { gradleHeapGb: num(heap), maxWorkers: num(workers), priority, stopDaemons: stop }
  const effective = mergeLimits(inherited ?? null, current)
  const rec = useMemo(() => (capacity ? recommendLimits(capacity) : null), [capacity])
  const checks = capacity ? checkLimits(effective, capacity) : []
  const byField = (f: LimitField) => checks.filter(c => c.field === f)
  const blocking = checks.filter(c => c.level === 'error')

  const ram = capacity?.memTotal ? Math.round(capacity.memTotal / GB) : null
  const cores = capacity?.cores ?? null

  // Unset: a machine inherits the organization default; the default leaves the build's own settings alone.
  const inheritLabel = (v: string | null | undefined) => (machine ? (v ? `Default (${v})` : 'Default') : 'Not set')

  const save = (limits: BuildLimits) => run(() => saveLimitsAction(orgSlug, machine, limits), { loading: 'Saving limits…', success: 'Limits saved.' })

  const useRecommended = () => {
    if (!rec) return
    setHeap(rec.values.gradleHeapGb ? String(rec.values.gradleHeapGb) : '')
    setWorkers(rec.values.maxWorkers ? String(rec.values.maxWorkers) : '')
    setPriority(rec.values.priority ?? null)
    setStop(rec.values.stopDaemons ?? null)
  }

  return (
    <form
      className='space-y-5'
      onSubmit={e => {
        e.preventDefault()
        if (!blocking.length) save(current)
      }}
    >
      {capacity && capacityLabel && <p className='bg-muted/60 rounded-md px-3 py-2 text-xs'>{capacityLabel}</p>}

      <fieldset disabled={!canEdit || pending} className='space-y-5'>
        <Row
          title='Gradle memory'
          hint='Heap of the Gradle daemon; the Kotlin daemon gets half. Lower it if the machine swaps, raise it on "Java heap space" errors.'
          control={
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={1}
                max={64}
                inputMode='numeric'
                aria-label='Gradle memory in GB'
                aria-invalid={byField('gradleHeapGb').some(c => c.level === 'error')}
                className='w-24'
                value={heap}
                placeholder={inherited?.gradleHeapGb ? String(inherited.gradleHeapGb) : 'auto'}
                onChange={e => setHeap(e.target.value)}
              />
              <span className='text-muted-foreground text-sm'>GB</span>
            </div>
          }
        >
          {ram && <MemoryBar ram={ram} heap={effective.gradleHeapGb ?? null} range={rec?.ranges.gradleHeapGb ?? null} />}
          <Recommended
            value={rec?.values.gradleHeapGb}
            unit=' GB'
            range={rec?.ranges.gradleHeapGb}
            why={rec?.why.gradleHeapGb}
            onUse={rec?.values.gradleHeapGb ? () => setHeap(String(rec.values.gradleHeapGb)) : undefined}
          />
          <Checks checks={byField('gradleHeapGb')} />
        </Row>

        <Row
          title='Parallel workers'
          hint='Gradle --max-workers and Xcode -jobs. Fewer workers = less CPU and RAM at once, slower build.'
          control={
            <Input
              type='number'
              min={1}
              max={128}
              inputMode='numeric'
              aria-label='Parallel workers'
              className='w-24'
              value={workers}
              placeholder={inherited?.maxWorkers ? String(inherited.maxWorkers) : 'all cores'}
              onChange={e => setWorkers(e.target.value)}
            />
          }
        >
          {cores && <CoreCells cores={cores} perf={capacity?.perfCores} workers={effective.maxWorkers ?? null} />}
          <Recommended
            value={rec?.values.maxWorkers}
            range={rec?.ranges.maxWorkers}
            why={rec?.why.maxWorkers}
            onUse={rec?.values.maxWorkers ? () => setWorkers(String(rec.values.maxWorkers)) : undefined}
          />
          <Checks checks={byField('maxWorkers')} />
        </Row>

        <Row
          title='CPU priority'
          hint='Low keeps the machine responsive while you work: builds take what other apps leave.'
          control={
            <Segmented
              label='CPU priority'
              value={priority ?? null}
              onChange={setPriority}
              options={[
                { value: null, label: inheritLabel(inherited?.priority) },
                { value: 'normal', label: 'Normal' },
                { value: 'low', label: 'Low' }
              ]}
            />
          }
        >
          <Recommended value={rec ? (rec.values.priority === 'low' ? 'Low' : 'Normal') : null} why={rec?.why.priority} />
          <Checks checks={byField('priority')} />
        </Row>

        <Row
          title='Stop Gradle daemons after the build'
          hint='Gives their memory back right away; the next build starts a little slower.'
          control={
            <Segmented
              label='Stop Gradle daemons after the build'
              value={stop}
              onChange={setStop}
              options={[
                { value: null, label: inheritLabel(inherited?.stopDaemons === undefined || inherited?.stopDaemons === null ? null : inherited.stopDaemons ? 'on' : 'off') },
                { value: true, label: 'On' },
                { value: false, label: 'Off' }
              ]}
            />
          }
        >
          <Recommended value={rec ? (rec.values.stopDaemons ? 'On' : 'Off') : null} why={rec?.why.stopDaemons} />
          <Checks checks={byField('stopDaemons')} />
        </Row>
      </fieldset>

      {canEdit && (
        <div className='space-y-2'>
          {blocking.length > 0 && <p className='text-xs text-red-700 dark:text-red-300'>Fix the values marked in red before saving: they can&apos;t work on this machine.</p>}
          <div className='flex flex-wrap items-center gap-2'>
            <Button type='submit' size='sm' disabled={pending || blocking.length > 0}>
              {pending && <Loader2Icon className='animate-spin' />}
              Save limits
            </Button>
            {rec && (
              <Button type='button' size='sm' variant='outline' onClick={useRecommended} disabled={pending}>
                <WandSparklesIcon /> Use all recommended
              </Button>
            )}
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={pending}
              onClick={() => {
                setHeap('')
                setWorkers('')
                setPriority(null)
                setStop(null)
                save({})
              }}
            >
              {machine ? 'Use the default' : 'Remove default limits'}
            </Button>
            {rec && <span className='text-muted-foreground text-xs'>Recommended: {describeLimits(rec.values).join(' · ') || 'no change'}</span>}
          </div>
        </div>
      )}
    </form>
  )
}

export default LimitsForm
