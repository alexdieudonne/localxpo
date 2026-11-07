'use client'

// React Imports
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

// Third-party Imports
import { ChevronsLeftRightIcon } from 'lucide-react'

import s from './landing.module.css'
import { reducedMotion } from './motion'

/**
 * Hero: the same failed Android build, as raw Gradle output (under) and as localxpo shows it (over).
 * The handle sweeps on its own until the visitor grabs it (mouse, touch or arrow keys).
 */

const RAW = [
  '> Configure project :app',
  'w: file:///app/build.gradle: Unchecked cast: Any? to Map<String, Any>',
  '> Task :expo-modules-core:preBuild UP-TO-DATE',
  '> Task :react-native-reanimated:configureCMakeRelWithDebInfo[arm64-v8a]',
  'C/C++: ninja: Entering directory `.cxx/RelWithDebInfo/4r3k1p1m/arm64-v8a',
  '> Task :app:mergeReleaseResources',
  '> Task :app:processReleaseManifest',
  'package="com.pebble.app" found in source AndroidManifest.xml',
  'Setting the namespace via the package attribute is no longer supported',
  '> Task :app:compileReleaseKotlin',
  'w: Parameter \'savedInstanceState\' is never used',
  '> Task :app:createBundleReleaseJsAndAssets',
  'Writing bundle output to: build/generated/assets/react/release/index.android.bundle',
  'warning: the transform cache was reset.',
  '> Task :app:compileReleaseJavaWithJavac',
  'Note: Some input files use or override a deprecated API.',
  'Note: Recompile with -Xlint:deprecation for details.',
  '> Task :app:mergeReleaseNativeLibs',
  '',
  'FAILURE: Build failed with an exception.',
  '',
  '* What went wrong:',
  'Could not determine the dependencies of task \':app:compileReleaseJavaWithJavac\'.',
  '> SDK location not found. Define a valid SDK location with an ANDROID_HOME',
  '  environment variable or by setting the sdk.dir path in your project\'s',
  '  local properties file at \'/Users/maya/pebble/android/local.properties\'.',
  '',
  '* Try:',
  '> Run with --stacktrace option to get the stack trace.',
  '> Run with --info or --debug option to get more log output.',
  '> Get more help at https://help.gradle.org.',
  '',
  'BUILD FAILED in 4m 12s',
  '612 actionable tasks: 598 executed, 14 up-to-date'
]

const STEPS: { name: string; time: string; state: 'ok' | 'fail' | 'skip' }[] = [
  { name: 'Read app config', time: '0.4 s', state: 'ok' },
  { name: 'Install dependencies', time: '14 s', state: 'ok' },
  { name: 'Prebuild native project', time: '9 s', state: 'ok' },
  { name: 'Gradle bundleRelease', time: '4m 12s', state: 'fail' },
  { name: 'Sign with upload key', time: '', state: 'skip' },
  { name: 'Upload to Google Play', time: '', state: 'skip' }
]

const MIN = 6
const MAX = 94

const SplitView = () => {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(58)
  const [auto, setAuto] = useState(true)
  const dragging = useRef(false)

  // The handle sweeps back and forth until the visitor takes over.
  useEffect(() => {
    if (!auto || reducedMotion()) return

    let frame = 0
    const start = performance.now()

    const loop = (t: number) => {
      setPos(50 + Math.sin((t - start) / 1400) * 24)
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frame)
  }, [auto])

  const moveTo = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect()

    if (!r) return
    setPos(Math.min(MAX, Math.max(MIN, ((clientX - r.left) / r.width) * 100)))
  }, [])

  const onDown = (e: PointerEvent) => {
    setAuto(false)
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    moveTo(e.clientX)
  }

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 4

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setAuto(false)
      setPos(p =>
        e.key === 'Home' ? MIN : e.key === 'End' ? MAX : Math.min(MAX, Math.max(MIN, p + (e.key === 'ArrowLeft' ? -step : step)))
      )
    }
  }

  return (
    <div
      ref={box}
      className={s.split}
      style={{ '--pos': `${pos}%` } as React.CSSProperties}
      onPointerDown={onDown}
      onPointerMove={e => dragging.current && moveTo(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* Under: what Gradle prints. */}
      <div className={s.splitRaw} aria-hidden>
        <div className={s.rawScroll}>
          {[...RAW, ...RAW].map((l, i) => (
            <div key={i} className={/FAILURE|wrong|SDK location|BUILD FAILED/.test(l) ? s.rawErr : l.startsWith('w:') || l.startsWith('warning') ? s.rawWarn : undefined}>
              {l || ' '}
            </div>
          ))}
        </div>
        <span className={`${s.splitTag} ${s.splitTagLeft}`}>Raw Gradle output</span>
      </div>

      {/* Over: the same build in localxpo, revealed right of the handle. */}
      <div className={s.splitClean} aria-label='The same failed build in localxpo: steps with timings, the error explained with its fix, and memory used.'>
        <span className={`${s.splitTag} ${s.splitTagRight}`}>In localxpo</span>
        <div className='grid h-full gap-4 p-5 pt-12 md:grid-cols-[1fr_1.15fr] md:gap-5 md:p-7 md:pt-14'>
          <div className={`${s.card} p-4`}>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-[15px] font-semibold tracking-tight'>Android production #48</p>
              <span className='rounded-full px-2 py-0.5 text-[12px] font-medium' style={{ background: 'rgba(214,69,69,.1)', color: '#c23b3b' }}>
                Failed
              </span>
            </div>
            <p className='text-[13px]' style={{ color: 'var(--slate)' }}>
              macbook-pro, started by Maya
            </p>
            <ol className='mt-4 grid gap-2.5'>
              {STEPS.map(st => (
                <li key={st.name} className='flex items-center justify-between gap-3 text-[13.5px]' style={{ color: st.state === 'skip' ? '#a3a8b0' : undefined }}>
                  <span className='flex min-w-0 items-center gap-2.5'>
                    <span className={s.dot} style={{ background: st.state === 'ok' ? 'var(--ok)' : st.state === 'fail' ? '#d64545' : 'var(--rule)' }} />
                    <span className='truncate'>{st.name}</span>
                  </span>
                  <span className='shrink-0 tabular-nums' style={{ color: 'var(--slate)' }}>
                    {st.time}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className='grid content-start gap-4'>
            <div className={`${s.card} p-4`}>
              <p className='text-[14px] font-semibold'>The Android SDK wasn&apos;t found</p>
              <p className='mt-1.5 text-[13.5px] leading-relaxed' style={{ color: 'var(--slate)' }}>
                Gradle doesn&apos;t know where the SDK is. Install it from Android Studio, then add this line to your shell profile and run the build again.
              </p>
              <p className={`${s.mono} mt-3 rounded-lg px-3 py-2 text-[12px]`} style={{ background: 'var(--fog)', overflowWrap: 'anywhere' }}>
                export ANDROID_HOME=~/Library/Android/sdk
              </p>
            </div>
            <div className={`${s.card} p-4`}>
              <div className='mb-1.5 flex justify-between text-[12.5px]' style={{ color: 'var(--slate)' }}>
                <span>Peak memory of the build</span>
                <span className='tabular-nums'>24.3 / 32 GB</span>
              </div>
              <div className={s.bar}>
                <div className={s.barFill} style={{ width: '76%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The handle. */}
      <div
        className={s.splitHandle}
        role='slider'
        tabIndex={0}
        aria-label='Compare raw output with localxpo'
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(100 - pos)}% localxpo`}
        onKeyDown={onKey}
        onFocus={() => setAuto(false)}
      >
        <span className={s.splitKnob}>
          <ChevronsLeftRightIcon className='size-4' />
        </span>
      </div>
    </div>
  )
}

export default SplitView
