'use client'

// React Imports
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Third-party Imports
import {
  ArrowUpRightIcon,
  ChevronsDownIcon,
  FileDownIcon,
  LightbulbIcon,
  SearchIcon,
  TriangleAlertIcon,
  WrapTextIcon
} from 'lucide-react'

// Component Imports
import { StatusIcon } from '@/components/builds/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// Lib Imports
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

// Type Imports
import type { BuildStep, LogLine } from '@/lib/server/builds'
import type { BuildIssue } from '@/lib/server/issues'

const ROW_HEIGHT = 20
const OVERSCAN = 30
const ERROR_RE = /\[!\]|(^|\s)(error|fatal):|\*\* (ARCHIVE|BUILD|EXPORT) FAILED \*\*|FAILURE:|BUILD FAILED|Exception|npm ERR!|ERR_PNPM|✖|❌/i
const WARN_RE = /(^|\s)warning:|\bWARN\b|⚠/i

type Props = {
  buildId: string

  /** API base for logs: builds (default) or submissions, which share the same contract. */
  kind?: 'builds' | 'submissions'
  initialStatus: string
  initialSteps: BuildStep[]
  initialIssues: BuildIssue[]
  startedAt: number | null
  finishedAt: number | null

  /** The store upload of this build, shown as the last step (click → its submission). */
  upload?: { label: string; status: string; detail: string; href: string } | null
}

const isDone = (s: string) => s === 'success' || s === 'failed' || s === 'canceled'

const BuildLive = ({ buildId, kind = 'builds', initialStatus, initialSteps, initialIssues, startedAt, finishedAt: initialFinished, upload }: Props) => {
  const [lines, setLines] = useState<LogLine[]>([])
  const [status, setStatus] = useState(initialStatus)
  const [steps, setSteps] = useState(initialSteps)
  const [issues, setIssues] = useState(initialIssues)
  const [finishedAt, setFinishedAt] = useState(initialFinished)
  const [loading, setLoading] = useState(true)
  const [stepFilter, setStepFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [followPref, setFollow] = useState(!isDone(initialStatus))
  const [wrap, setWrap] = useState(false)
  const [highlightSeq, setHighlightSeq] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const follow = followPref && !isDone(status)

  const cursor = useRef(-1)
  const viewport = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  // ---------- Fetching: drain all pages, then poll while the build runs ----------
  const fetchMore = useCallback(async (signal?: AbortSignal) => {
    let more = true

    while (more) {
      const res = await fetch(`/api/v1/${kind}/${buildId}/logs?after=${cursor.current}&limit=5000`, { cache: 'no-store', signal })

      if (!res.ok || signal?.aborted) return

      const data = (await res.json()) as {
        lines: LogLine[]
        cursor: number
        status: string
        steps: BuildStep[]
        issues: BuildIssue[]
        finishedAt: number | null
      }

      if (signal?.aborted) return

      // Only lines after the last one we have: two overlapping polls (React dev mounts effects twice,
      // or a slow response) must never add the same line twice.
      if (data.lines.length)
        setLines(prev => {
          const last = prev.length ? prev[prev.length - 1].seq : -1
          const fresh = data.lines.filter(l => l.seq > last)

          return fresh.length ? prev.concat(fresh) : prev
        })
      cursor.current = Math.max(cursor.current, data.cursor)
      setStatus(data.status)
      setSteps(data.steps)
      setIssues(data.issues)
      setFinishedAt(data.finishedAt)
      more = data.lines.length === 5000
    }

    setLoading(false)
  }, [buildId, kind])

  const statusRef = useRef(status)
  const router = useRouter()

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()

    const tick = async () => {
      await fetchMore(controller.signal).catch(() => {})

      // Keep polling while the build runs; one final fetch happens after it finishes.
      if (!stopped && !isDone(statusRef.current)) timer = setTimeout(tick, 1500)
    }

    tick()

    return () => {
      stopped = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [fetchMore])

  useEffect(() => {
    const wasRunning = !isDone(statusRef.current)

    statusRef.current = status

    if (isDone(status)) {
      // Refresh the server-rendered header (status badge, duration, artifact) once the build ends.
      if (wasRunning) router.refresh()
    }
  }, [status, router])

  // The upload runs after the build (often as its own job): refresh until it ends so its step stays current.
  const uploadPending = Boolean(upload && !['success', 'failed', 'canceled', 'skipped'].includes(upload.status))

  useEffect(() => {
    if (!uploadPending || !isDone(status)) return
    const t = setInterval(() => router.refresh(), 5000)

    return () => clearInterval(t)
  }, [uploadPending, status, router])

  // Live duration counter
  useEffect(() => {
    if (isDone(status)) return
    const t = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(t)
  }, [status])

  // ---------- Filtering ----------
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()

    return lines.filter(
      l =>
        (!stepFilter || l.step === stepFilter) &&
        (!errorsOnly || ERROR_RE.test(l.line)) &&
        (!q || l.line.toLowerCase().includes(q))
    )
  }, [lines, stepFilter, errorsOnly, query])

  const lineCountByStep = useMemo(() => {
    const m = new Map<string, number>()

    for (const l of lines) m.set(l.step, (m.get(l.step) ?? 0) + 1)

    return m
  }, [lines])

  // ---------- Virtual scroll ----------
  useEffect(() => {
    const el = viewport.current

    if (!el) return
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight))

    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  // Position we scrolled to ourselves (following new lines): scroll events landing there aren't the user's.
  const autoScrollTop = useRef<number | null>(null)
  const lastScrollTop = useRef(0)

  // Layout effect: stick to the bottom before paint, so new lines never flash at the old position.
  useLayoutEffect(() => {
    const el = viewport.current

    if (!follow || !el) return
    el.scrollTop = el.scrollHeight
    autoScrollTop.current = el.scrollTop
  }, [visible.length, follow, viewportHeight])

  const pauseFollow = () => {
    if (follow) setFollow(false)
  }

  const onScroll = () => {
    const el = viewport.current

    if (!el) return
    const top = el.scrollTop
    const movedUp = top < lastScrollTop.current - 1

    lastScrollTop.current = top
    setScrollTop(top)

    if (autoScrollTop.current !== null && Math.abs(top - autoScrollTop.current) < 2) return
    autoScrollTop.current = null

    // Any upward move by the user pauses "follow" (even a few pixels, so the next batch of lines can't
    // yank the view back down); scrolling all the way back to the bottom resumes it while building.
    const atBottom = el.scrollHeight - top - el.clientHeight < ROW_HEIGHT / 2

    if (movedUp) pauseFollow()
    else if (atBottom && !follow && !isDone(status)) setFollow(true)
  }

  // Wheel / touch / keys signal intent before the scroll event arrives: pause right away.
  const onWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) pauseFollow()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) pauseFollow()
  }

  const start = wrap ? 0 : Math.max(Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN, 0)
  const end = wrap ? visible.length : Math.min(Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN, visible.length)

  const jumpTo = (seq: number) => {
    setStepFilter(null)
    setErrorsOnly(false)
    setQuery('')
    setFollow(false)
    setHighlightSeq(seq)

    requestAnimationFrame(() => {
      const idx = lines.findIndex(l => l.seq === seq)

      if (idx >= 0 && viewport.current) viewport.current.scrollTop = Math.max(idx * ROW_HEIGHT - 120, 0)
    })
  }

  const issueSeqs = useMemo(() => new Set(issues.map(i => i.seq)), [issues])
  const failed = status === 'failed'
  const elapsed = startedAt ? (finishedAt ?? (isDone(status) ? startedAt : now)) - startedAt : null

  return (
    <div className='space-y-6'>
      {issues.length > 0 && (
        <Card className={cn('min-w-0 gap-4', failed ? 'border-destructive/40' : '')}>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {failed ? (
                <TriangleAlertIcon className='text-destructive size-5' />
              ) : (
                <LightbulbIcon className='size-5 text-amber-500' />
              )}
              {failed ? 'What went wrong' : 'Things we noticed'}
            </CardTitle>
          </CardHeader>
          <CardContent className='grid min-w-0 grid-cols-1 gap-3'>
            {issues.map(issue => (
              <div key={issue.id} className='bg-muted/40 min-w-0 rounded-lg border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                  <p className='font-medium'>{issue.title}</p>
                  <Button variant='outline' size='xs' className='shrink-0' onClick={() => jumpTo(issue.seq)}>
                    Show in log
                  </Button>
                </div>
                <p className='text-muted-foreground mt-1 text-sm'>{issue.explanation}</p>
                <p className='mt-2 text-sm'>
                  <span className='font-medium'>Fix: </span>
                  {issue.fix}
                </p>
                <pre className='bg-background text-muted-foreground mt-3 overflow-x-auto rounded-md border px-3 py-2 font-mono text-xs'>
                  {issue.line}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className={cn('grid gap-6', kind === 'builds' && 'lg:grid-cols-[260px_minmax(0,1fr)]')}>
        {/* Steps */}
        {kind === 'builds' && (
        <Card size='sm' className='h-fit'>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              Steps
              <span className='text-muted-foreground font-mono text-xs font-normal tabular-nums' suppressHydrationWarning>
                {formatDuration(elapsed)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className='px-2'>
            <button
              type='button'
              onClick={() => setStepFilter(null)}
              className={cn(
                'hover:bg-muted flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm',
                !stepFilter && 'bg-muted font-medium'
              )}
            >
              All logs
              <span className='text-muted-foreground text-xs tabular-nums'>{lines.length.toLocaleString()}</span>
            </button>
            <ol className='mt-1 space-y-0.5'>
              {steps.map(s => {
                const dur = s.started_at ? (s.finished_at ?? (s.status === 'in_progress' ? now : s.started_at)) - s.started_at : null

                return (
                  <li key={s.key}>
                    <button
                      type='button'
                      onClick={() => setStepFilter(s.key)}
                      className={cn(
                        'hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                        stepFilter === s.key && 'bg-muted font-medium'
                      )}
                    >
                      <StatusIcon status={s.status} />
                      <span className='min-w-0 flex-1 truncate'>{s.name}</span>
                      <span className='text-muted-foreground font-mono text-xs tabular-nums' suppressHydrationWarning>
                        {s.status === 'skipped' ? 'skip' : dur != null ? formatDuration(dur) : (lineCountByStep.get(s.key) ?? '')}
                      </span>
                    </button>
                  </li>
                )
              })}
              {steps.length === 0 && <li className='text-muted-foreground px-2 py-1.5 text-sm'>Waiting for the CLI…</li>}
            </ol>
            {upload && (
              <div className='mt-1 border-t pt-1'>
                <Link
                  href={upload.href}
                  className='hover:bg-muted group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm'
                  title='Open the upload: its own logs and status'
                >
                  <StatusIcon status={upload.status} />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate'>{upload.label}</span>
                    <span className='text-muted-foreground block truncate text-xs'>{upload.detail}</span>
                  </span>
                  <ArrowUpRightIcon className='text-muted-foreground group-hover:text-foreground size-3.5 shrink-0' />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Logs */}
        <Card className='min-w-0 gap-0 py-0'>
          <div className='flex flex-wrap items-center gap-2 border-b p-3'>
            <div className='relative min-w-40 flex-1'>
              <SearchIcon className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder='Filter lines…' className='pl-8' />
            </div>
            <label className='flex items-center gap-2 text-sm'>
              <Switch checked={errorsOnly} onCheckedChange={setErrorsOnly} />
              Errors only
            </label>
            <Button variant={wrap ? 'secondary' : 'ghost'} size='icon-sm' onClick={() => setWrap(w => !w)} title='Wrap long lines'>
              <WrapTextIcon />
            </Button>
            <Button
              variant={follow ? 'secondary' : 'ghost'}
              size='icon-sm'
              onClick={() => setFollow(f => !f)}
              title='Follow new lines'
            >
              <ChevronsDownIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              render={<a href={`/api/v1/${kind}/${buildId}/logs?format=text`} download />}
              nativeButton={false}
              title='Download full log'
            >
              <FileDownIcon />
            </Button>
          </div>

          <div
            ref={viewport}
            onScroll={onScroll}
            onWheel={onWheel}
            onTouchMove={pauseFollow}
            onKeyDown={onKeyDown}
            tabIndex={0}
            className='h-[65vh] min-h-80 overflow-auto overscroll-contain bg-zinc-950 font-mono text-[12.5px] leading-5 text-zinc-200 outline-none'
          >
            {loading && lines.length === 0 ? (
              <p className='p-4 text-zinc-400'>Loading logs…</p>
            ) : visible.length === 0 ? (
              <p className='p-4 text-zinc-400'>
                {lines.length === 0 ? (isDone(status) ? 'No log lines were received.' : 'Waiting for output…') : 'No lines match.'}
              </p>
            ) : (
              <div style={wrap ? undefined : { height: visible.length * ROW_HEIGHT, position: 'relative', minWidth: 'max-content' }}>
                <div style={wrap ? undefined : { transform: `translateY(${start * ROW_HEIGHT}px)` }}>
                  {visible.slice(start, end).map(l => {
                    const isErr = l.stream !== 'system' && ERROR_RE.test(l.line)

                    return (
                      <div
                        key={l.seq}
                        className={cn(
                          'flex px-3 hover:bg-white/5',
                          wrap ? 'min-h-5' : 'h-5',
                          l.stream === 'system' && 'font-semibold text-sky-300',
                          isErr && 'bg-red-500/10 text-red-300',
                          !isErr && WARN_RE.test(l.line) && 'text-amber-200',
                          l.stream === 'stderr' && !isErr && 'text-zinc-400',
                          (issueSeqs.has(l.seq) || highlightSeq === l.seq) && 'bg-amber-400/20 ring-1 ring-amber-400/40 ring-inset'
                        )}
                      >
                        <span className='w-14 shrink-0 pr-3 text-right text-zinc-600 select-none'>{l.seq + 1}</span>
                        <span className={wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre'}>{l.line || ' '}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div className='text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs'>
            <span>
              {visible.length.toLocaleString()} of {lines.length.toLocaleString()} lines
            </span>
            {!isDone(status) && (
              <span className='flex items-center gap-1.5'>
                <span className='size-2 animate-pulse rounded-full bg-sky-500' /> Live
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default BuildLive
