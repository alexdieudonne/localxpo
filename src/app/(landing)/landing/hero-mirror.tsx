'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

import s from './landing.module.css'

/**
 * The hero: a build running in a terminal on the left, the same build landing in the dashboard on the right.
 * One scripted loop; with reduced motion it shows the finished build, still.
 */

type Tone = 'dim' | 'ok' | 'ember' | undefined
type Line = { text: string; tone?: Tone; step?: number; ram?: number; ship?: boolean }

const STEPS = ['Read app config', 'Install dependencies', 'Prebuild native project', 'Gradle assembleRelease', 'Sign with upload key', 'Upload to Google Play']

const SCRIPT: Line[] = [
  { text: '$ npx localxpo build -p android --profile production', step: 0, ram: 18 },
  { text: '✓ Pebble 2.4.0, com.pebble.app', tone: 'ok' },
  { text: '› pnpm install --frozen-lockfile', tone: 'dim', step: 1, ram: 26 },
  { text: '  Done in 14.2s', tone: 'dim' },
  { text: '› expo prebuild --platform android', tone: 'dim', step: 2, ram: 31 },
  { text: '› ./gradlew :app:bundleRelease', tone: 'dim', step: 3, ram: 58 },
  { text: '  > Task :app:compileReleaseKotlin', tone: 'dim', ram: 71 },
  { text: '  > Task :app:createBundleReleaseJsAndAssets', tone: 'dim', ram: 76 },
  { text: '  BUILD SUCCESSFUL in 4m 12s', tone: 'ok', ram: 49 },
  { text: '› signing app-release.aab (keystore from the dashboard)', tone: 'dim', step: 4, ram: 22 },
  { text: '› uploading to Play Console, internal track', tone: 'dim', step: 5, ram: 19 },
  { text: '✓ Shipped in 5m 01s. Testers get it in a few minutes.', tone: 'ok', step: 6, ram: 12 }
]

const TONE: Record<Exclude<Tone, undefined>, string> = { dim: s.dim, ok: s.okText, ember: s.emberText }

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const HeroMirror = () => {
  const [shown, setShown] = useState(SCRIPT.length)

  useEffect(() => {
    if (prefersReducedMotion()) return

    let i = 0
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      i = i >= SCRIPT.length ? 1 : i + 1
      setShown(i)
      timer = setTimeout(tick, i >= SCRIPT.length ? 5200 : i === 1 ? 1100 : 720 + (i % 3) * 180)
    }

    timer = setTimeout(tick, 400)

    return () => clearTimeout(timer)
  }, [])

  const lines = SCRIPT.slice(0, shown)

  const { step, ram } = useMemo(() => {
    let step = 0
    let ram = 0

    for (const l of lines) {
      if (l.step !== undefined) step = l.step
      if (l.ram !== undefined) ram = l.ram
    }

    return { step, ram }
  }, [lines])

  const done = step >= STEPS.length
  const shipped = lines.slice(-6)

  return (
    <div className={s.mirror} role='img' aria-label='A build running in a terminal on your Mac while the same logs, steps and memory use appear live in the localxpo dashboard.'>
      <div className={s.terminal} aria-hidden>
        <div className={s.termBar}>
          <span>maya@macbook-pro ~/pebble</span>
          <span>zsh</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className={l.tone ? TONE[l.tone] : undefined} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {l.text}
          </div>
        ))}
        {!done && <span className={s.cursor} />}
      </div>

      <div className={s.pane} aria-hidden>
        <span className={s.wire} />
        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate text-[15px] font-semibold tracking-tight'>Android production build #48</p>
            <p className='text-[13px]' style={{ color: 'var(--slate)' }}>
              macbook-pro, started by Maya
            </p>
          </div>
          <span
            className='flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-medium'
            style={done ? { background: 'rgba(31,157,85,.1)', color: 'var(--ok)' } : { background: 'rgba(245,73,0,.1)', color: 'var(--ember)' }}
          >
            {done ? <span className={s.dot} style={{ background: 'var(--ok)' }} /> : <span className={`${s.dot} ${s.spin}`} style={{ width: 10, height: 10 }} />}
            {done ? 'Shipped' : 'Building'}
          </span>
        </div>

        <ol className='grid gap-2'>
          {STEPS.map((name, i) => {
            const state = i < step ? 'done' : i === step ? 'run' : 'wait'

            return (
              <li key={name} className={s.step} style={{ color: state === 'wait' ? '#a3a8b0' : undefined }}>
                <span className='flex min-w-0 items-center gap-2.5'>
                  {state === 'run' ? (
                    <span className={`${s.dot} ${s.spin}`} style={{ width: 10, height: 10 }} />
                  ) : (
                    <span className={s.dot} style={{ background: state === 'done' ? 'var(--ok)' : 'var(--rule)' }} />
                  )}
                  <span className='truncate'>{name}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <div>
          <div className='mb-1.5 flex justify-between text-[12px]' style={{ color: 'var(--slate)' }}>
            <span>Memory used by the build</span>
            <span className='tabular-nums'>{((ram / 100) * 32).toFixed(1)} / 32 GB</span>
          </div>
          <div className={s.bar}>
            <div className={s.barFill} style={{ width: `${ram}%` }} />
          </div>
        </div>

        <div className={s.paneLog}>
          {shipped.map((l, i) => (
            <div key={`${shown}-${i}`} className={i === shipped.length - 1 && !prefersReducedMotion() ? s.arrive : undefined} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {l.text.replace(/^\$ /, '')}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HeroMirror
