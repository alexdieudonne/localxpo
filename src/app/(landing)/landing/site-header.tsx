// Next Imports
import Link from 'next/link'

import s from './landing.module.css'
import { LandingHeader } from './motion'

/** Header shared by the landing page and the docs. On the docs, section links go back to the landing page. */

export const Mark = () => (
  <svg viewBox='0 0 32 32' className='size-7' aria-hidden>
    <rect width='32' height='32' rx='10' fill='#16181c' />
    <path d='M10 9v13h8' stroke='#fff' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round' fill='none' />
    <path d='M15.5 16.5 23 9m0 0h-5.5M23 9v5.5' stroke='#f54900' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round' fill='none' />
  </svg>
)

/** Kept short on purpose: features, the hosted offer, prices, docs. */
export const NAV = [
  { href: '#build', label: 'Features' },
  { href: '#cloud', label: 'Cloud' },
  { href: '#pricing', label: 'Pricing' }
]

const SiteHeader = ({ user, cloud, base = '', active }: { user: boolean; cloud: boolean; base?: string; active?: 'docs' }) => (
<LandingHeader>
    <div className={`${s.wrap} ${s.headerInner} flex items-center justify-between gap-4`}>
      <Link href={user ? '/landing' : '/'} className='flex items-center gap-2.5 text-[17px] font-semibold tracking-tight'>
        <Mark /> localxpo
      </Link>
      <nav className='hidden items-center gap-1 md:flex' aria-label='Sections'>
        {NAV.map(x => (
          <a key={x.href} href={`${base}${x.href}`} className={`${s.btn} ${s.btnGhost}`} style={{ height: 36, paddingInline: 12, color: 'var(--slate)' }}>
            {x.label}
          </a>
        ))}
        <Link
          href='/docs'
          className={`${s.btn} ${s.btnGhost}`}
          style={{ height: 36, paddingInline: 12, color: active === 'docs' ? 'var(--ink)' : 'var(--slate)' }}
          aria-current={active === 'docs' ? 'page' : undefined}
        >
          Docs
        </Link>
      </nav>
      <div className='flex items-center gap-1'>
        {user ? (
          <Link href='/' className={`${s.btn} ${s.btnInk}`} style={{ height: 38 }}>
            Open dashboard
          </Link>
        ) : (
          <>
            <Link href='/login' className={`${s.btn} ${s.btnGhost} hidden sm:inline-flex`} style={{ height: 38 }}>
              Sign in
            </Link>
            <Link href='/register' className={`${s.btn} ${s.btnInk}`} style={{ height: 38 }}>
              <span>
                {cloud ? (
                  <>
                    Start free<span className='hidden sm:inline'> on Cloud</span>
                  </>
                ) : (
                  'Create account'
                )}
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
</LandingHeader>
)

export default SiteHeader
