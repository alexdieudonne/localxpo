'use client'

// React Imports
import { useEffect, useState } from 'react'

import s from './landing.module.css'
import { reducedMotion, useInView, useOnScreen } from './motion'

/* ---------- Team activity feed (dark section) ---------- */

type Kind = 'start' | 'ok' | 'ship' | 'fail' | 'reuse'
type Event = { id: number; kind: Kind; text: string; who: string; machine: string }

const EVENTS: Omit<Event, 'id'>[] = [
  { kind: 'start', text: 'iOS preview #52 started', who: 'Inès', machine: 'mac-mini-office' },
  { kind: 'reuse', text: 'Android #51 reused build #49', who: 'Tom', machine: 'build-box' },
  { kind: 'ok', text: 'Android #51 built in 1m 12s', who: 'Tom', machine: 'build-box' },
  { kind: 'ship', text: '#51 uploaded to Google Play', who: 'Tom', machine: 'build-box' },
  { kind: 'fail', text: 'iOS #50 failed: profile expired', who: 'Maya', machine: 'macbook-pro' },
  { kind: 'ok', text: 'iOS preview #52 built in 6m 40s', who: 'Inès', machine: 'mac-mini-office' },
  { kind: 'ship', text: '#52 uploaded to TestFlight', who: 'Inès', machine: 'mac-mini-office' },
  { kind: 'start', text: 'Android #53 started from the web', who: 'Maya', machine: 'build-box' }
]

const KIND: Record<Kind, { color: string; label: string }> = {
  start: { color: '#f54900', label: 'Started' },
  ok: { color: '#1f9d55', label: 'Built' },
  reuse: { color: '#4f63d8', label: 'Reused' },
  ship: { color: '#1f9d55', label: 'Shipped' },
  fail: { color: '#d64545', label: 'Failed' }
}

const MACHINES = [
  { name: 'macbook-pro', role: 'iOS, Android', base: 22 },
  { name: 'mac-mini-office', role: 'iOS, Android', base: 64 },
  { name: 'build-box', role: 'Android', base: 48 }
]

export const LiveFeed = () => {
  const [ref, on] = useOnScreen<HTMLDivElement>()
  const [events, setEvents] = useState<Event[]>(() => EVENTS.slice(0, 4).map((e, i) => ({ ...e, id: i })).reverse())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!on || reducedMotion()) return

    const t = setInterval(() => {
      setTick(n => n + 1)
      setEvents(list => {
        const next = list[0].id + 1

        return [{ ...EVENTS[next % EVENTS.length], id: next }, ...list].slice(0, 5)
      })
    }, 2400)

    return () => clearInterval(t)
  }, [on])

  return (
    <div ref={ref} className='grid gap-4 lg:grid-cols-[1.4fr_1fr]'>
      <ol className={s.feed} aria-label='Recent activity, example'>
        {events.map((e, i) => (
          <li key={e.id} className={i === 0 && tick > 0 ? s.feedNew : undefined}>
            <span className={s.feedDot} style={{ background: KIND[e.kind].color }} />
            <span className='min-w-0 flex-1'>
              <span className='block truncate font-medium'>{e.text}</span>
              <span className='block truncate text-[12.5px]' style={{ color: 'var(--slate)' }}>
                {e.who} on {e.machine}
              </span>
            </span>
            <span className='shrink-0 text-[12px]' style={{ color: KIND[e.kind].color }}>
              {KIND[e.kind].label}
            </span>
          </li>
        ))}
      </ol>

      <div className='grid gap-3'>
        {MACHINES.map((m, i) => {
          // A gentle wave per machine, so the bars look alive without being random noise.
          const load = Math.round(Math.max(6, Math.min(96, m.base + Math.sin((tick + i * 2) * 0.9) * 18)))

          return (
            <div key={m.name} className={s.machineTile}>
              <div className='flex items-center justify-between gap-2'>
                <span className='truncate font-medium'>{m.name}</span>
                <span className='flex items-center gap-1.5 text-[12px]' style={{ color: 'var(--ok)' }}>
                  <span className={s.pulse} /> Online
                </span>
              </div>
              <p className='mt-0.5 text-[12.5px]' style={{ color: 'var(--slate)' }}>
                Builds {m.role}
              </p>
              <div className='mt-3 flex items-center gap-3'>
                <div className={s.meter}>
                  <div style={{ width: `${load}%` }} />
                </div>
                <span className='w-16 text-right text-[12px] tabular-nums' style={{ color: 'var(--slate)' }}>{load}% CPU</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Memory chart that draws itself (Machines section) ---------- */

const SERIES_BUILD = [6, 9, 12, 12, 18, 30, 44, 58, 66, 71, 74, 70, 52, 30, 22, 14, 10, 9, 14, 26, 41, 55, 63, 60]
const SERIES_ALL = [38, 40, 44, 45, 50, 60, 70, 80, 86, 89, 90, 88, 74, 56, 50, 44, 42, 41, 46, 58, 70, 80, 84, 82]
const WINDOW = 16

const toPath = (values: number[], w: number, h: number, close = false) => {
  const step = w / (WINDOW - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`)

  return `M${pts.join(' L')}${close ? ` L${((values.length - 1) * step).toFixed(1)},${h} L0,${h} Z` : ''}`
}

export const LiveMemory = () => {
  const [ref, on] = useOnScreen<HTMLDivElement>()
  const [start, setStart] = useState(0)

  useEffect(() => {
    if (!on || reducedMotion()) return

    const t = setInterval(() => setStart(n => (n + 1) % SERIES_BUILD.length), 1100)

    return () => clearInterval(t)
  }, [on])

  const pick = (series: number[]) => Array.from({ length: WINDOW }, (_, i) => series[(start + i) % series.length])
  const build = pick(SERIES_BUILD)
  const all = pick(SERIES_ALL)
  const now = build[build.length - 1]
  const pressure = all[all.length - 1] > 85 ? 'Elevated' : 'Normal'

  return (
    <div ref={ref}>
      <svg viewBox='-2 -6 328 122' className='mt-3 h-auto w-full overflow-visible' role='img' aria-label='Memory use of the build and of the whole machine over the last minute'>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1='0' x2='320' y1={110 * f} y2={110 * f} stroke='var(--rule)' strokeDasharray='2 4' />
        ))}
        <path d={toPath(all, 320, 110)} fill='none' stroke='#b6bac1' strokeWidth='1.5' className={s.chartPath} />
        <path d={toPath(build, 320, 110, true)} fill='rgba(245,73,0,.12)' className={s.chartPath} />
        <path d={toPath(build, 320, 110)} fill='none' stroke='var(--ember)' strokeWidth='2' className={s.chartPath} />
        <circle cx='320' cy={110 - (now / 100) * 110} r='4' fill='var(--ember)' className={s.chartPath} />
      </svg>
      <dl className='mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]'>
        {[
          ['Build memory', `${((now / 100) * 32).toFixed(1)} GB`],
          ['Memory pressure', pressure],
          ['CPU, average', '612%'],
          ['Energy', '14 Wh']
        ].map(([k, v]) => (
          <div key={k}>
            <dt style={{ color: 'var(--slate)' }}>{k}</dt>
            <dd className='font-semibold tabular-nums'>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ---------- Raw error, then the explanation (Build section) ---------- */

const RAW = 'SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable.'

export const ErrorExplainer = () => {
  const [ref, seen] = useInView<HTMLDivElement>()
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (!seen) return

    let n = reducedMotion() ? RAW.length - 3 : 0

    const t = setInterval(() => {
      n += 3
      setTyped(Math.min(n, RAW.length))
      if (n >= RAW.length) clearInterval(t)
    }, 28)

    return () => clearInterval(t)
  }, [seen])

  const done = typed >= RAW.length

  return (
    <div ref={ref}>
      <p className={`${s.mono} mt-3 rounded-lg px-3 py-2 text-[11.5px]`} style={{ background: 'var(--fog)', color: '#3b3f47', minHeight: 52 }}>
        {RAW.slice(0, typed)}
        {!done && <span className={s.caret} />}
      </p>
      <p className={`mt-3 text-[13.5px] leading-relaxed ${s.reveal}`} data-on={done || undefined} style={{ color: 'var(--slate)' }}>
        The Android SDK isn&apos;t where Gradle looks for it. Install it from Android Studio, then add{' '}
        <span className={s.mono} style={{ color: 'var(--ink)' }}>
          export ANDROID_HOME=~/Library/Android/sdk
        </span>{' '}
        to your shell profile.
      </p>
    </div>
  )
}
