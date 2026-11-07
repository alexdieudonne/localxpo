'use client'

// React Imports
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Third-party Imports
import { CheckIcon } from 'lucide-react'

// Component Imports
import Logo from '@/components/shared/Logo'

/**
 * Shared frame of /login and /register. It stays mounted between the two pages, so when you switch, the dark
 * panel slides across to the other side while the form slides the opposite way. Sign-in: form left, panel
 * right; sign-up: the mirror image. On small screens there is only the form.
 */

type Line = { text: string; tone?: 'dim' | 'ok' }

export type AuthAside = {
  heading: string
  terminal: Line[]
  points: string[]
}

const EASE = 'ease-[cubic-bezier(0.76,0,0.24,1)]'

const Panel = ({ aside, active }: { aside: AuthAside; active: boolean }) => (
  <div
    aria-hidden={!active}
    className={`absolute inset-0 flex flex-col justify-center p-12 transition-[opacity,translate] duration-500 motion-reduce:transition-none ${
      active ? 'translate-y-0 opacity-100 delay-300' : 'pointer-events-none translate-y-3 opacity-0'
    }`}
  >
    <div className='mx-auto w-full max-w-lg'>
      <p className='text-[1.75rem] leading-tight font-semibold tracking-tight text-balance text-white'>{aside.heading}</p>

      <div className='mt-8 rounded-xl border border-white/10 bg-black/30 p-5 font-mono text-[12.5px] leading-7'>
        {aside.terminal.map((l, i) => (
          <div key={i} className={`truncate whitespace-pre ${l.tone === 'ok' ? 'text-[#4fd18b]' : l.tone === 'dim' ? 'text-[#8a909b]' : ''}`}>
            {l.text}
          </div>
        ))}
      </div>

      <ul className='mt-8 grid gap-3 text-[15px]'>
        {aside.points.map(p => (
          <li key={p} className='flex gap-3'>
            <CheckIcon className='mt-0.5 size-4 shrink-0 text-[#ff7a3d]' />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
)

const AuthShell = ({ asides, children }: { asides: { login: AuthAside; register: AuthAside }; children: ReactNode }) => {
  const register = usePathname().startsWith('/register')

  return (
    <div className='bg-background group relative min-h-screen w-full overflow-hidden' data-side={register ? 'right' : 'left'}>
      {/* The form half: left for sign-in, slides to the right half for sign-up. */}
      <div
        className={`relative flex min-h-screen flex-col px-5 py-6 transition-transform duration-700 motion-reduce:transition-none sm:px-10 lg:w-1/2 lg:group-data-[side=right]:translate-x-full ${EASE}`}
      >
        <Link href='/' className='w-fit rounded-md' aria-label='localxpo home'>
          <Logo className='gap-2.5 [&_span]:text-lg' />
        </Link>
        <div className='flex flex-1 items-center justify-center py-10'>
          <div className='w-full max-w-sm'>{children}</div>
        </div>
      </div>

      {/* The dark half: right for sign-in, slides to the left half for sign-up. */}
      <aside
        className={`absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden bg-[#16181c] text-[#d8dbe0] transition-transform duration-700 motion-reduce:transition-none lg:block lg:group-data-[side=right]:-translate-x-full ${EASE}`}
      >
        <div className='pointer-events-none absolute -top-40 -right-40 h-[480px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(245,73,0,0.22),transparent)]' />
        <div className='pointer-events-none absolute -bottom-48 -left-40 h-[480px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(140,130,255,0.18),transparent)]' />
        <Panel aside={asides.login} active={!register} />
        <Panel aside={asides.register} active={register} />
      </aside>
    </div>
  )
}

export default AuthShell
