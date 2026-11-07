// Next Imports
import Link from 'next/link'

// Lib Imports
import { formatHistory, formatLimit, formatPrice, PLAN_ORDER, PLANS, TRIAL_DAYS } from '@/lib/plans'
import { getCurrentUser } from '@/lib/server/auth'
import { isCloud } from '@/lib/server/billing'
import { productJsonLd } from '@/lib/seo'
import { OG_IMAGES } from '@/lib/site'
import JsonLd from '@/components/shared/JsonLd'

import CopyCommand from './copy-command'
import HeroMirror from './hero-mirror'
import { LiveFeed } from './live'
import { ParallaxController, RevealController } from './motion'
import SiteHeader, { Mark } from './site-header'
import s from './landing.module.css'
import './utilities.css'
import { AgentsPreview, BuildPreview, MachinesPreview, SubmitPreview } from './previews'

/**
 * Product landing page. Served at / to visitors without a session (src/proxy.ts rewrites to /landing).
 */

export const dynamic = 'force-dynamic'

const TITLE = 'Build Expo apps locally: EAS Build alternative | localxpo'

const DESCRIPTION =
  'Build, sign and submit Expo and React Native apps for iOS and Android on your own Mac or PC with fastlane. Live logs, store submissions and a team dashboard. Free for one machine.'

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'localxpo', url: '/', title: TITLE, description: DESCRIPTION, images: OG_IMAGES }
}


type FeatureProps = {
  id: string
  command: string
  title: string
  lead: string
  bullets: { strong: string; rest: string }[]
  preview: React.ReactNode
  flip?: boolean
}

const Feature = ({ id, command, title, lead, bullets, preview, flip }: FeatureProps) => (
  <section id={id} className={s.section} style={{ scrollMarginTop: 72 }}>
    <div className={`${s.wrap} ${s.sectionGrid} ${flip ? s.flip : ''}`}>
      <div data-reveal>
        <p className={s.command}>{command}</p>
        <h2 className={`${s.h2} mt-4`}>{title}</h2>
        <p className={`${s.lead} mt-4`}>{lead}</p>
        <ul className={s.bullets}>
          {bullets.map(b => (
            <li key={b.strong}>
              <strong>{b.strong}</strong> {b.rest}
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties}>
        <div data-speed={flip ? '0.06' : '-0.06'} className={s.parallax}>
          {preview}
        </div>
      </div>
    </div>
  </section>
)

const LandingPage = async () => {
  const user = await getCurrentUser()

  // Cloud: the page sells localxpo Cloud. Self-hosted: it is the front page of this server, where everything is included.
  const cloud = isCloud()
  const signUp = cloud ? 'Create a free Cloud account' : 'Create an account'

  return (
    <div className={`${s.root} lx-landing`}>
      <ParallaxController />
      <RevealController />
      <SiteHeader user={Boolean(user)} cloud={cloud} />
      {cloud && <JsonLd data={productJsonLd()} />}

      <main>
        <section className={`${s.hero} pb-16`}>
          <div className={s.mesh} aria-hidden>
            <span className={s.blobA} data-speed='0.22' />
            <span className={s.blobB} data-speed='0.1' />
            <span className={s.blobC} data-speed='0.3' />
            <span className={s.blobD} data-speed='0.16' />
          </div>
          <div className={s.grain} aria-hidden />
          <svg className={s.waves} viewBox='0 0 1440 220' preserveAspectRatio='none' aria-hidden>
            <path d='M0 120 C 240 60 480 60 720 110 S 1200 170 1440 100 L1440 220 L0 220 Z' fill='rgba(255,255,255,.55)' />
            <path d='M0 170 C 300 120 540 130 780 165 S 1220 200 1440 150 L1440 220 L0 220 Z' fill='#ffffff' />
          </svg>
          <div className={`${s.wrap} relative`}>
            <div className='grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16'>
              <h1 className={s.h1} aria-label='Expo builds, on the machines you already own.'>
                {'Expo builds, on the machines you already own.'.split(' ').map((w, i) => (
                  <span key={i} aria-hidden>
                    <span className={s.word} style={{ '--d': `${80 + i * 55}ms` } as React.CSSProperties}>
                      {w}
                    </span>{' '}
                  </span>
                ))}
              </h1>
              <div className={s.enter} style={{ '--d': '450ms' } as React.CSSProperties}>
                <p className={s.lead}>
                  localxpo builds and signs your Expo and React Native apps for iOS and Android on your own Mac or PC, then ships them to the stores. Every log line, step
                  and gigabyte of memory lands in one dashboard, {cloud ? 'hosted for your team on localxpo Cloud' : 'running on this server for your whole team'}.
                </p>
                <div className='mt-7 flex flex-wrap items-center gap-3'>
                  <Link href={user ? '/' : '/register'} className={`${s.btn} ${s.btnInk}`}>
                    {user ? 'Open dashboard' : cloud ? 'Start free on Cloud' : 'Create an account'}
                  </Link>
                  <CopyCommand command='npx localxpo link' />
                </div>
                <p className='mt-4 text-[14px]' style={{ color: 'var(--slate)' }}>
                  {cloud
                    ? `Open source, and free on Cloud for one machine with no card needed. Pro is ${formatPrice(PLANS.pro.price.month)} a month with a ${TRIAL_DAYS}-day trial.`
                    : 'Open source under MIT. This server is self-hosted: every feature is included, with no plan or limit.'}{' '}
                  <a href='#cloud' className='font-medium underline underline-offset-4' style={{ color: 'var(--ink)' }}>
                    About Cloud
                  </a>
                </p>
              </div>
            </div>

            <div className={`mt-12 md:mt-14 ${s.enter}`} style={{ '--d': '650ms' } as React.CSSProperties}>
              <div data-speed='-0.05' className={s.parallax}>
                {/* Alternative hero: <SplitView /> from ./split-view (raw Gradle output vs localxpo, draggable). */}
                <HeroMirror />
              </div>
            </div>

            <p className={`${s.tools} mt-12`} data-reveal>
              <em className='w-full text-center not-italic sm:w-auto'>Uses the tools you already have:</em> <span>Expo</span> <span>fastlane</span> <span>Xcode</span> <span>Gradle</span> <span>CocoaPods</span>{' '}
              <span>EAS credentials</span>
            </p>
          </div>
        </section>

        <section id='how' className={s.section} style={{ scrollMarginTop: 72 }}>
          <div className={s.wrap}>
            <h2 className={s.h2} data-reveal>
              From npx to the stores in three commands.
            </h2>
            <p className={`${s.lead} mt-4`}>Nothing to configure by hand: each command picks up what the one before set up.</p>
            <ol className={`${s.steps} mt-10`}>
              {[
                {
                  title: 'Link the project',
                  text: 'Signs you in, creates the project in the dashboard and imports your signing keys from Expo.',
                  term: ['$ npx localxpo link', '✓ Signed in as maya@pebble.app', '✓ Keystore imported from EAS']
                },
                {
                  title: 'Build on your machine',
                  text: 'fastlane runs locally while every line streams to the build page.',
                  term: ['$ npx localxpo build -p ios', '› pod install (cached)', '✓ Built in 6m 40s']
                },
                {
                  title: 'Ship to the stores',
                  text: 'Uploads to TestFlight or Google Play with keys checked beforehand.',
                  term: ['$ npx localxpo submit -p ios', '› App Store Connect key verified', '✓ Processing at Apple']
                }
              ].map((step, i) => (
                <li key={step.title} className={s.stepCard} data-reveal style={{ '--d': `${i * 110}ms` } as React.CSSProperties}>
                  <span className={s.stepNo}>{i + 1}</span>
                  <div>
                    <p className='text-[17px] font-semibold tracking-tight'>{step.title}</p>
                    <p className='mt-1.5 text-[14.5px] leading-relaxed' style={{ color: 'var(--slate)' }}>
                      {step.text}
                    </p>
                  </div>
                  <div className={s.miniTerm} aria-hidden>
                    {step.term.map(l => (
                      <div key={l} className={l.startsWith('✓') ? s.okText : l.startsWith('›') ? s.dim : undefined}>
                        {l}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>


        <Feature
          id='build'
          command='npx localxpo build'
          title='Your Mac is the build server.'
          lead='Builds run with fastlane on your machine, with your caches and your Xcode. No queue, no build minutes, no upload of your source code.'
          bullets={[
            { strong: 'Skips what didn’t change.', rest: 'When the native fingerprint matches an earlier build, only the JavaScript is rebuilt.' },
            { strong: 'Errors you can read.', rest: 'Known Xcode, Gradle and CocoaPods failures come with what went wrong and how to fix it.' },
            { strong: 'Live in the browser.', rest: 'Logs stream to the build page while it runs, and stay there after it ends.' }
          ]}
          preview={<BuildPreview />}
        />

        <Feature
          id='submit'
          flip
          command='npx localxpo submit'
          title='To TestFlight and Google Play in one command.'
          lead='The first time you link a project, localxpo picks up the signing keys and store credentials from your Expo account and your machine, and stores them encrypted for the team.'
          bullets={[
            { strong: 'Checked before upload.', rest: 'Apple and Google keys are verified the moment they are saved, not at 2 a.m. on release night.' },
            { strong: 'Queued after the build.', rest: 'Start a build with “upload when it succeeds” and the submission waits for it.' },
            { strong: 'One place for keys.', rest: 'Keystores, App Store Connect keys and service accounts live on the Credentials page.' }
          ]}
          preview={<SubmitPreview />}
        />

        <Feature
          id='agents'
          command='npx localxpo agent'
          title='Start a build from the dashboard.'
          lead='Leave the agent running on any machine and it picks up builds started from the browser. A Mac takes iOS; Linux and Windows boxes take Android.'
          bullets={[
            { strong: 'Online or offline, at a glance.', rest: 'Each machine shows when it last checked in and what it can build.' },
            { strong: 'Cancel from anywhere.', rest: 'Stop a running build or upload from the build page; the machine stops within seconds.' },
            { strong: 'No silent failures.', rest: 'A build whose machine goes quiet for three minutes is marked failed, and resumes if the machine comes back.' }
          ]}
          preview={<AgentsPreview />}
        />

        <section className={s.night} aria-labelledby='live-title'>
          <div className={s.nightGlow} data-speed='0.1' aria-hidden />
          <div className={`${s.wrap} relative`}>
            <div className='grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16'>
              <div data-reveal>
                <h2 id='live-title' className={s.h2}>
                  The whole team&apos;s builds, as they happen.
                </h2>
                <p className={`${s.lead} mt-4`}>
                  Every build, upload and failure from every machine shows up in one activity feed, with who started it and where it ran.
                </p>
                <dl className={s.stats}>
                  <div>
                    <dt>Builds today</dt>
                    <dd className='tabular-nums'>38</dd>
                  </div>
                  <div>
                    <dt>Reused builds</dt>
                    <dd className='tabular-nums'>61%</dd>
                  </div>
                  <div>
                    <dt>Store uploads</dt>
                    <dd className='tabular-nums'>12</dd>
                  </div>
                </dl>
                <p className='mt-4 text-[12.5px]' style={{ color: 'var(--slate)' }}>
                  Example team. Your numbers appear on the dashboard home page.
                </p>
              </div>
              <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties}>
                <LiveFeed />
              </div>
            </div>
          </div>
        </section>

        <Feature
          id='machines'
          flip
          command='npx localxpo build --no-limits'
          title='See what each build costs your machine.'
          lead='Memory, memory pressure, CPU and energy are sampled during every build, next to the same numbers for the whole machine.'
          bullets={[
            { strong: 'Limits from the dashboard.', rest: 'Cap the Gradle heap and parallel workers, or run builds at low CPU priority, per machine. --no-limits skips them once.' },
            { strong: 'Recommended values.', rest: 'Each limit is checked against the machine’s memory and cores, and flagged when it is too low or too high.' },
            { strong: 'Trends over 30 days.', rest: 'Compare build times and peaks across machines to pick the right one.' }
          ]}
          preview={<MachinesPreview />}
        />

        <section id='cloud' className={s.section} style={{ scrollMarginTop: 72 }}>
          <div className={s.wrap}>
            <div className={s.cloud} data-reveal>
              <div>
                <h2 className={s.h2}>localxpo Cloud runs the dashboard for you.</h2>
                <p className={`${s.lead} mt-4`}>
                  Your machines keep doing the builds. Cloud hosts everything around them: the dashboard, the database, the encrypted store keys and
                  the history, so the team signs up and links a project instead of running a server. Unlike cloud build services, there are no
                  build minutes to buy.
                </p>
                <ul className={s.bullets}>
                  <li>
                    <strong>Nothing to host.</strong> No server, database or certificates to maintain. Point the CLI at Cloud and build.
                  </li>
                  <li>
                    <strong>One place for the team.</strong> Members, shared credentials and every build, kept for up to{' '}
                    {formatHistory(PLANS.business.limits.historyDays)}.
                  </li>
                  <li>
                    <strong>Billed per organization.</strong> Start free, upgrade when you add machines or teammates, cancel from the billing page.
                  </li>
                </ul>
                {cloud ? (
                  <div className='mt-8 flex flex-wrap items-center gap-3'>
                    <Link href={user ? '/' : '/register'} className={`${s.btn} ${s.btnInk}`}>
                      {user ? 'Open dashboard' : signUp}
                    </Link>
                    <Link href='/pricing' className={`${s.btn} ${s.btnGhost}`}>
                      Compare plans
                    </Link>
                  </div>
                ) : (
                  <p className='mt-8 text-[14px]' style={{ color: 'var(--slate)' }}>
                    This server is self-hosted, so you already have all of it. Cloud is for teams that would rather not run one.
                  </p>
                )}
              </div>

              <div className={`${s.card} overflow-hidden`}>
                <div className='flex items-baseline justify-between gap-3 px-5 pt-5 pb-4'>
                  <p className='text-[15px] font-semibold'>Pro on Cloud</p>
                  <p>
                    <span className='text-[1.75rem] font-semibold tracking-tight tabular-nums'>{formatPrice(PLANS.pro.price.month)}</span>
                    <span className='text-[14px]' style={{ color: 'var(--slate)' }}>
                      {' '}
                      / month
                    </span>
                  </p>
                </div>
                {[
                  { label: `${PLANS.pro.limits.members} members and ${PLANS.pro.limits.machines} build machines`, soon: false },
                  { label: `${formatHistory(PLANS.pro.limits.historyDays)} of builds, logs and metrics`, soon: false },
                  { label: 'Everything in Free: live logs, metrics and store uploads', soon: false },
                  { label: 'Install links with a QR code for testers', soon: true },
                  { label: 'Slack, Discord and email notifications', soon: true },
                  { label: 'GitHub: build on push, status on pull requests', soon: true },
                  { label: 'Scheduled builds', soon: true }
                ].map(f => (
                  <div key={f.label} className='flex items-center justify-between gap-3 px-5 py-3 text-[14px]' style={{ borderTop: '1px solid var(--rule)' }}>
                    <span>{f.label}</span>
                    {f.soon ? (
                      <span className='shrink-0 rounded-full px-2 py-0.5 text-[12px]' style={{ background: 'var(--fog)', color: 'var(--slate)' }}>
                        Soon
                      </span>
                    ) : (
                      <span className='shrink-0 text-[13px]' style={{ color: 'var(--ok)' }}>
                        Included
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={`${s.ways} mt-6`} data-reveal style={{ '--d': '120ms' } as React.CSSProperties}>
              <div className={`${s.way} ${s.wayBest}`}>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-[17px] font-semibold tracking-tight'>localxpo Cloud</p>
                  <span className={s.bestTag}>Recommended</span>
                </div>
                <p className='mt-1.5 text-[14.5px] leading-relaxed' style={{ color: 'var(--slate)' }}>
                  The open-source dashboard, run and kept up to date for you. Sign up, link a project, build.
                </p>
                <ul className={`${s.bullets} mt-4`}>
                  <li>Ready in a minute, nothing to install or maintain</li>
                  <li>New versions arrive on their own, without redeploying</li>
                  <li>Pro features for teams: install links, notifications, GitHub, schedules (coming)</li>
                </ul>
                {cloud && !user && (
                  <Link href='/register' className={`${s.btn} ${s.btnInk} mt-6`}>
                    Start free on Cloud
                  </Link>
                )}
              </div>
              <div className={s.way}>
                <p className='text-[17px] font-semibold tracking-tight'>Self-hosted, open source</p>
                <p className='mt-1.5 text-[14.5px] leading-relaxed' style={{ color: 'var(--slate)' }}>
                  The same code under the MIT license, on your own server. Free, every feature unlocked.
                </p>
                <ul className={`${s.bullets} mt-4`}>
                  <li>Embedded Postgres, or bring your own database</li>
                  <li>You run upgrades, backups and the encryption key</li>
                  <li>Read, fork and change everything</li>
                </ul>
                <Link href='/docs#self-host' className={`${s.btn} ${s.btnGhost} mt-6`} style={{ paddingInline: 0 }}>
                  Self-hosting guide
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id='pricing' className={s.section} style={{ scrollMarginTop: 72 }}>
          <div className={s.wrap}>
            <h2 className={s.h2}>{cloud ? 'Free for one machine. Pay when the team grows.' : 'Cloud plans, if you ever want them.'}</h2>
            <p className={`${s.lead} mt-4`}>
              {cloud
                ? `Prices are per organization. Builds always run on your hardware, so there are no build minutes to count. Paid plans start with a ${TRIAL_DAYS}-day trial, and self-hosting stays free with everything included.`
                : 'This server is self-hosted: no plan, no limits. On localxpo Cloud, prices are per organization, and builds still run on your own hardware.'}
            </p>
            <div className={`${s.plans} mt-10`} data-reveal>
              {PLAN_ORDER.map(id => {
                const p = PLANS[id]

                return (
                  <div key={id} className={`${s.plan} ${p.popular ? s.planPopular : ''}`}>
                    <h3 className='text-[15px] font-semibold'>{p.name}</h3>
                    <p className='mt-1'>
                      <span className='text-[2rem] font-semibold tracking-tight tabular-nums'>{formatPrice(p.price.month)}</span>
                      <span className='text-[14px]' style={{ color: 'var(--slate)' }}>
                        {p.price.month ? ' / month' : ''}
                      </span>
                    </p>
                    <p className='text-[14px] leading-relaxed' style={{ color: 'var(--slate)' }}>
                      {formatLimit(p.limits.members, 'members')}, {formatLimit(p.limits.machines, 'machines').toLowerCase()},{' '}
                      {formatHistory(p.limits.historyDays)} of history.
                    </p>
                  </div>
                )
              })}
            </div>
            {cloud && (
              <p className='mt-5 text-[14px]'>
                <Link href='/pricing' className='font-medium underline underline-offset-4'>
                  Compare plans
                </Link>
              </p>
            )}
          </div>
        </section>

        <section id='developers' className={s.section} style={{ scrollMarginTop: 72 }}>
          <div className={`${s.wrap} ${s.sectionGrid}`}>
            <div data-reveal>
              <p className={s.command}>npx localxpo --help</p>
              <h2 className={`${s.h2} mt-4`}>Made for developers who like their terminal.</h2>
              <p className={`${s.lead} mt-4`}>
                A CLI with ten commands, profiles read from your eas.json, tokens for CI, and a REST API for everything the dashboard shows. Open source under MIT.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-3'>
                <Link href='/docs' className={`${s.btn} ${s.btnInk}`}>
                  Read the docs
                </Link>
                <Link href='/docs#api' className={`${s.btn} ${s.btnGhost}`}>
                  REST API
                </Link>
              </div>
            </div>
            <div data-reveal style={{ '--d': '120ms' } as React.CSSProperties}>
              <div className={s.terminal} style={{ borderRadius: 16, minHeight: 0 }} aria-label='Example: building in CI with a token'>
                <div className={s.termBar}>
                  <span>.github/workflows/release.yml</span>
                  <span>CI</span>
                </div>
                {[
                  { t: '- name: Build and ship', c: undefined },
                  { t: '  run: npx localxpo build -p ios --submit', c: undefined },
                  { t: '  env:', c: s.dim },
                  { t: '    LOCALXPO_URL: ${{ vars.LOCALXPO_URL }}', c: s.dim },
                  { t: '    LOCALXPO_TOKEN: ${{ secrets.LOCALXPO_TOKEN }}', c: s.dim },
                  { t: '', c: undefined },
                  { t: '✓ Build #54 on macos-runner, 7m 02s', c: s.okText },
                  { t: '✓ Uploaded to TestFlight', c: s.okText }
                ].map((l, i) => (
                  <div key={i} className={l.c} style={{ whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.t || '\u00a0'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className='pb-24'>
          <div className={s.wrap}>
            <div className={s.closing} data-reveal>
              <h2 className={s.h2} style={{ maxWidth: '16ch' }}>
                Link your first app in under a minute.
              </h2>
              <p className='mt-4 max-w-[52ch] text-[17px] leading-relaxed' style={{ color: '#b9bdc5' }}>
                Run one command in your Expo project. It signs you in, creates the project and sets up your store credentials.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-3'>
                <Link href={user ? '/' : '/register'} className={s.btn} style={{ background: '#fff', color: 'var(--ink)' }}>
                  {user ? 'Open dashboard' : signUp}
                </Link>
                <span className={`${s.mono} text-[14px]`} style={{ color: '#d8dbe0' }}>
                  <span style={{ color: '#8a909b' }}>$ </span>npx localxpo link
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className='border-t py-8 text-[14px]' style={{ borderColor: 'var(--rule)', color: 'var(--slate)' }}>
        <div className={`${s.wrap} flex flex-wrap items-center justify-between gap-4`}>
          <span className='flex items-center gap-2'>
            <Mark /> © {new Date().getFullYear()} localxpo
          </span>
          <nav className='flex gap-5' aria-label='Footer'>
            <Link href={cloud ? '/pricing' : '#pricing'} className='hover:text-[var(--ink)]'>
              Pricing
            </Link>
            <Link href='/docs' className='hover:text-[var(--ink)]'>
              Docs
            </Link>
            <Link href='/docs#self-host' className='hover:text-[var(--ink)]'>
              Open source (MIT)
            </Link>
            <Link href='/login' className='hover:text-[var(--ink)]'>
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
