import s from './landing.module.css'
import { ErrorExplainer, LiveMemory } from './live'

/** Static product previews for the landing sections, drawn in the dashboard's vocabulary. */

const Dot = ({ color }: { color: string }) => <span className={s.dot} style={{ background: color }} />

const Row = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] ${className}`} style={{ borderTop: '1px solid var(--rule)' }}>
    {children}
  </div>
)

const muted = { color: 'var(--slate)' }

export const BuildPreview = () => (
  <div className={s.preview}>
    <div className={`${s.card} overflow-hidden`}>
      <div className='px-4 pt-4 pb-3'>
        <p className='text-[15px] font-semibold tracking-tight'>iOS production build #47</p>
        <p className='text-[13px]' style={muted}>
          Native code unchanged since #45: the app was rebuilt from that binary in 41 s.
        </p>
      </div>
      <Row>
        <span className='flex items-center gap-2.5'>
          <Dot color='var(--ok)' /> Fingerprint 3f9c21 matches build #45
        </span>
        <span className='tabular-nums' style={muted}>
          reused
        </span>
      </Row>
      <Row>
        <span className='flex items-center gap-2.5'>
          <Dot color='var(--ok)' /> JS bundle and assets
        </span>
        <span className='tabular-nums' style={muted}>
          38 s
        </span>
      </Row>
    </div>

    <div className={`${s.card} mt-4 p-4`}>
      <p className='flex items-center gap-2.5 text-[14px] font-semibold'>
        <Dot color='var(--ember)' /> Android build #46 failed in Gradle
      </p>
      <ErrorExplainer />
    </div>
  </div>
)

export const SubmitPreview = () => (
  <div className={s.preview}>
    <div className={`${s.card} overflow-hidden`}>
      <div className='px-4 pt-4 pb-3'>
        <p className='text-[15px] font-semibold tracking-tight'>Store keys</p>
        <p className='text-[13px]' style={muted}>
          Found in your Expo account when you ran <span className={s.mono}>localxpo link</span>.
        </p>
      </div>
      <Row>
        <span>App Store Connect API key</span>
        <span className='flex items-center gap-2 text-[12.5px]' style={{ color: 'var(--ok)' }}>
          <Dot color='var(--ok)' /> verified with Apple
        </span>
      </Row>
      <Row>
        <span>Google Play service account</span>
        <span className='flex items-center gap-2 text-[12.5px]' style={{ color: 'var(--ok)' }}>
          <Dot color='var(--ok)' /> verified with Google
        </span>
      </Row>
      <Row>
        <span>Android upload keystore</span>
        <span className='text-[12.5px]' style={muted}>
          imported from EAS
        </span>
      </Row>
    </div>

    <div className={`${s.card} mt-4 overflow-hidden`}>
      <Row className='border-t-0' >
        <span className='flex items-center gap-2.5'>
          <Dot color='var(--ok)' /> TestFlight, build #47
        </span>
        <span className='text-[12.5px]' style={muted}>
          processing at Apple
        </span>
      </Row>
      <Row>
        <span className='flex items-center gap-2.5'>
          <span className={`${s.dot} ${s.spin}`} style={{ width: 10, height: 10 }} /> Play internal track, build #48
        </span>
        <span className='text-[12.5px]' style={muted}>
          waiting for the build
        </span>
      </Row>
    </div>
  </div>
)

export const AgentsPreview = () => (
  <div className={s.preview}>
    <div className={`${s.card} overflow-hidden`}>
      <div className='flex items-center justify-between px-4 pt-4 pb-3'>
        <p className='text-[15px] font-semibold tracking-tight'>Machines</p>
        <span className='rounded-lg px-3 py-1.5 text-[13px] font-medium text-white' style={{ background: 'var(--ink)' }}>
          New build
        </span>
      </div>
      {[
        { name: 'macbook-pro', os: 'macOS 26, M3 Max', can: 'iOS and Android', online: true },
        { name: 'build-box', os: 'Ubuntu 24.04, Ryzen 9', can: 'Android', online: true },
        { name: 'mac-mini-office', os: 'macOS 15, M2', can: 'iOS and Android', online: false }
      ].map(m => (
        <Row key={m.name}>
          <span className='min-w-0'>
            <span className='block truncate font-medium'>{m.name}</span>
            <span className='block truncate text-[12.5px]' style={muted}>
              {m.os}. Builds {m.can}.
            </span>
          </span>
          <span className='flex shrink-0 items-center gap-2 text-[12.5px]' style={{ color: m.online ? 'var(--ok)' : 'var(--slate)' }}>
            <Dot color={m.online ? 'var(--ok)' : '#b6bac1'} /> {m.online ? 'Online' : 'Offline'}
          </span>
        </Row>
      ))}
    </div>
    <div className={`${s.card} mt-4 p-4 text-[13.5px]`}>
      <p className='font-medium'>Android production on build-box</p>
      <p className='mt-1' style={muted}>
        Then upload to Google Play when it succeeds. Queued behind build #48.
      </p>
    </div>
  </div>
)

export const MachinesPreview = () => (
  <div className={s.preview}>
    <div className={`${s.card} p-4`}>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <p className='flex items-center gap-2 text-[15px] font-semibold tracking-tight'>
          <span className={s.pulseEmber} /> Memory during build #53, live
        </p>
        <p className='flex items-center gap-4 text-[12px]' style={muted}>
          <span className='flex items-center gap-1.5'>
            <Dot color='var(--ember)' /> This build
          </span>
          <span className='flex items-center gap-1.5'>
            <Dot color='#b6bac1' /> Whole machine
          </span>
        </p>
      </div>
      <LiveMemory />
    </div>
    <div className={`${s.card} mt-4 flex items-center justify-between gap-4 p-4 text-[13.5px]`}>
      <span>
        <span className='block font-medium'>Parallel workers: 4</span>
        <span className='block' style={muted}>
          Recommended for this machine: 4 to 6
        </span>
      </span>
      <span className='rounded-lg px-3 py-1.5 font-medium' style={{ background: 'var(--fog)' }}>
        Limit
      </span>
    </div>
  </div>
)
