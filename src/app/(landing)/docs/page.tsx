// React Imports
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'

// Lib Imports
import { getCurrentUser } from '@/lib/server/auth'
import { isCloud } from '@/lib/server/billing'
import { OG_IMAGES } from '@/lib/site'

import '../landing/utilities.css'
import s from '../landing/landing.module.css'
import SiteHeader, { Mark } from '../landing/site-header'
import CodeBlock from './code-block'
import d from './docs.module.css'
import Toc, { type TocGroup } from './toc'

/** Developer documentation, part of the public site next to the landing page. */

export const dynamic = 'force-dynamic'

const TITLE = 'Docs: local Expo builds, CLI, fastlane and self-hosting | localxpo'

const DESCRIPTION =
  'Install the localxpo CLI, link an Expo project, build and sign iOS and Android apps locally, submit to TestFlight and Google Play, use CI tokens and the REST API, or self-host the dashboard.'

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/docs' },
  openGraph: { type: 'article', siteName: 'localxpo', url: '/docs', title: TITLE, description: DESCRIPTION, images: OG_IMAGES }
}

const GROUPS: TocGroup[] = [
  {
    title: 'Get started',
    items: [
      { id: 'quick-start', label: 'Quick start' },
      { id: 'requirements', label: 'Requirements' },
      { id: 'how-it-works', label: 'How it works' }
    ]
  },
  {
    title: 'CLI',
    items: [
      { id: 'commands', label: 'Commands' },
      { id: 'build', label: 'Building' },
      { id: 'submit', label: 'Submitting' },
      { id: 'credentials', label: 'Store credentials' },
      { id: 'agent', label: 'Agents' },
      { id: 'ci', label: 'CI and tokens' }
    ]
  },
  {
    title: 'Dashboard',
    items: [
      { id: 'env', label: 'Environment variables' },
      { id: 'metrics', label: 'Metrics and limits' },
      { id: 'logs', label: 'Logs and errors' }
    ]
  },
  {
    title: 'Reference',
    items: [
      { id: 'api', label: 'REST API' },
      { id: 'self-host', label: 'Self-hosting' }
    ]
  }
]

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{title}</h2>
    {children}
  </section>
)

const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className={d.table}>
    <table>
      <thead>
        <tr>
          {head.map(h => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const C = ({ children }: { children: ReactNode }) => <code>{children}</code>

const ENDPOINTS: { m: 'GET' | 'POST' | 'PATCH' | 'PUT'; path: string; what: string }[] = [
  { m: 'POST', path: '/api/v1/auth/login', what: 'Email and password → API token and organizations' },
  { m: 'GET', path: '/api/v1/me', what: 'The signed-in user' },
  { m: 'GET', path: '/api/v1/orgs', what: 'Your organizations' },
  { m: 'GET', path: '/api/v1/projects?org=', what: 'Projects of an organization' },
  { m: 'POST', path: '/api/v1/projects', what: 'Create or update a project by slug (what link does)' },
  { m: 'GET', path: '/api/v1/projects/:id/env?environment=', what: 'Environment variables for development, preview or production' },
  { m: 'GET', path: '/api/v1/builds?projectId=&platform=&status=', what: 'List builds, newest first (limit, offset)' },
  { m: 'POST', path: '/api/v1/builds', what: 'Start a build record' },
  { m: 'GET', path: '/api/v1/builds/:id', what: 'One build, with steps and status' },
  { m: 'PATCH', path: '/api/v1/builds/:id', what: 'Finish a build: status, error, artifact, fingerprint' },
  { m: 'PUT', path: '/api/v1/builds/:id/steps', what: 'Create or update a step' },
  { m: 'GET', path: '/api/v1/builds/:id/logs?after=', what: 'Log lines after a sequence number (?format=text to download)' },
  { m: 'POST', path: '/api/v1/builds/:id/logs', what: 'Append log lines, idempotent on seq' },
  { m: 'GET', path: '/api/v1/builds/compatible?fingerprint=', what: 'An earlier successful build with the same native fingerprint' },
  { m: 'POST', path: '/api/v1/submissions', what: 'Start a store upload for a build' },
  { m: 'PATCH', path: '/api/v1/submissions/:id', what: 'Finish an upload' }
]

const METHOD = { GET: d.get, POST: d.post, PATCH: d.patch, PUT: d.put }

const DocsPage = async () => {
  const user = await getCurrentUser()
  const cloud = isCloud()

  return (
    <div className={`${s.root} lx-landing`}>
      <SiteHeader user={Boolean(user)} cloud={cloud} base={user ? '/landing' : '/'} active='docs' />

      <header className={d.hero}>
        <div className={s.wrap}>
          <h1 className={s.h2} style={{ maxWidth: '22ch' }}>
            localxpo for developers
          </h1>
          <p className={`${s.lead} mt-4`}>
            Everything to build and ship Expo apps from your own machines: the CLI, store credentials, dashboard builds, CI and the REST API. localxpo is open source
            under MIT; the quickest way to start is {cloud ? <Link href='/register' className='font-medium text-[var(--ink)] underline underline-offset-4'>localxpo Cloud</Link> : 'localxpo Cloud'}, where nothing needs to be hosted.
          </p>
          <div className={d.cards} style={{ maxWidth: 760 }}>
            <a href='#quick-start' className={d.cardLink}>
              <strong>Quick start</strong>
              <span>From an Expo project to a build on the dashboard in three commands.</span>
            </a>
            <a href='#commands' className={d.cardLink}>
              <strong>CLI reference</strong>
              <span>Every command and option of npx localxpo.</span>
            </a>
            <a href='#api' className={d.cardLink}>
              <strong>REST API</strong>
              <span>The endpoints the CLI uses, with a token you create in the dashboard.</span>
            </a>
            <a href='#self-host' className={d.cardLink}>
              <strong>Self-hosting</strong>
              <span>Run the dashboard on your own server, with embedded Postgres or yours.</span>
            </a>
          </div>
        </div>
      </header>

      <div className={`${s.wrap} ${d.layout}`}>
        <Toc groups={GROUPS} />

        <main className={d.content}>
          <Section id='quick-start' title='Quick start'>
            <p>
              In the folder of an Expo app, link the project once. It signs you in{cloud ? ' to localxpo Cloud' : ''}, picks the organization, creates the project in the
              dashboard and sets up your store credentials.
            </p>
            <CodeBlock
              code={`npx localxpo link
npx localxpo build -p android --profile preview      # build here, logs stream to the dashboard
npx localxpo build -p ios --profile production --submit   # build, then upload to TestFlight`}
            />
            <p>
              <C>link</C> writes a small <C>localxpo.json</C> in the project with the dashboard URL and project id; every other command reads it. Profiles come from your
              existing <C>eas.json</C>, so nothing needs to change in the app.
            </p>
          </Section>

          <Section id='requirements' title='Requirements'>
            <ul>
              <li>Node.js 20 or newer, and the package manager of the project (npm, yarn, pnpm or bun).</li>
              <li>
                <strong>fastlane</strong>: <C>brew install fastlane</C> or <C>gem install fastlane</C>. A <C>Gemfile</C> with fastlane is used through <C>bundle exec</C>.
              </li>
              <li>Android: a JDK and the Android SDK (<C>ANDROID_HOME</C> set). Any macOS, Linux or Windows machine works.</li>
              <li>iOS: macOS with Xcode and CocoaPods.</li>
            </ul>
            <p>Check a machine before the first build:</p>
            <CodeBlock code='npx localxpo doctor     # Node, fastlane, JDK, Android SDK, Xcode, CocoaPods…' />
          </Section>

          <Section id='how-it-works' title='How it works'>
            <p>
              The CLI runs the whole build on your machine with fastlane, and reports to the dashboard over HTTPS: log lines in batches, steps, metrics and the result. The
              dashboard never runs builds and never receives your source code or binaries.
            </p>
            <Table
              head={['Step', 'Android', 'iOS (macOS)']}
              rows={[
                ['Read app config', 'eas.json profile, then npx expo config with its env', 'Same'],
                ['Install dependencies', 'Frozen lockfile', 'Same'],
                ['Native fingerprint', '@expo/fingerprint, compared with earlier builds', 'Same'],
                ['Generate native project', <>expo prebuild when <C>android/</C> is generated</>, <>Same with <C>ios/</C></>],
                ['Build', 'fastlane gradle, signed with the upload key', 'fastlane build_app with the App Store Connect key'],
                ['Upload', 'fastlane upload_to_play_store', 'fastlane upload_to_testflight']
              ]}
            />
            <p>
              The Fastfile is written to a private temporary folder for each build, never into your project, and every value is passed as an environment variable. Key files are
              deleted when the build ends, including on Ctrl+C.
            </p>
          </Section>

          <Section id='commands' title='Commands'>
            <Table
              head={['Command', 'What it does']}
              rows={[
                [<C key='a'>link</C>, 'Sign in, pick the organization, connect this project, set up store credentials'],
                [<C key='a'>build -p android|ios</C>, 'Build on this machine and stream it to the dashboard'],
                [<C key='a'>submit</C>, 'Upload one of your builds to TestFlight or Google Play'],
                [<C key='a'>credentials</C>, 'Run the store credentials setup again and check store access'],
                [<C key='a'>agent</C>, 'Keep this machine connected so builds can start from the dashboard'],
                [<C key='a'>doctor</C>, 'Check the tools this machine needs'],
                [<C key='a'>logs -f</C>, 'Follow your latest build from any terminal'],
                [<C key='a'>builds</C>, 'Recent builds of the project'],
                [<C key='a'>orgs</C>, <>Your organizations; <C>org use &lt;slug&gt;</C> sets the default</>],
                [<C key='a'>sync</C>, 'Upload log lines that could not be sent earlier']
              ]}
            />
            <p>
              Run them with <C>npx localxpo …</C>, or install once with <C>npm i -g localxpo</C> (the short alias <C>lxp</C> works too).
            </p>
          </Section>

          <Section id='build' title='Build an Expo app locally (iOS and Android)'>
            <CodeBlock
              code={`npx localxpo build -p ios --profile production
npx localxpo build -p android --profile preview --clean   # re-run expo prebuild --clean
npx localxpo build -p android -q                           # only errors and step headers`}
            />
            <Table
              head={['Option', 'Default', 'Meaning']}
              rows={[
                [<C key='a'>--profile</C>, 'production', 'eas.json build profile'],
                [<C key='a'>--submit</C>, '–', 'Upload to the store once the build succeeds'],
                [<C key='a'>--clean</C>, '–', 'Regenerate the native project'],
                [<C key='a'>--skip-install</C>, '–', 'Skip installing dependencies'],
                [<C key='a'>--no-limits</C>, '–', 'Ignore the resource limits set on the dashboard for this build'],
                [<C key='a'>-o, --output</C>, 'localxpo-output/', 'Where the .ipa, .aab or .apk is written'],
                [<C key='a'>--org</C>, 'from localxpo.json', 'Organization to report to']
              ]}
            />
            <p>
              When a successful build already exists with the same native fingerprint, the CLI tells you; a build that only changes JavaScript can reuse it.
            </p>
          </Section>

          <Section id='submit' title='Submit to TestFlight and Google Play'>
            <CodeBlock
              code={`npx localxpo submit                  # choose from a list
npx localxpo submit --latest         # newest build on this machine, no prompt
npx localxpo submit --build=<id>     # a specific build
npx localxpo submit --path app.aab   # any .ipa or .aab`}
            />
            <p>
              Each upload is a submission with its own logs on the dashboard. Binaries never leave the machine, so a build is submitted from the machine that made it (or with{' '}
              <C>--path</C>). The Play track comes from <C>submit.&lt;profile&gt;.android.track</C> in eas.json (default <C>internal</C>).
            </p>
          </Section>

          <Section id='credentials' title='Code signing and store credentials'>
            <p>
              <C>link</C> and <C>credentials</C> find what builds and uploads need, and only ask for what they can&apos;t find:
            </p>
            <ol>
              <li>
                <strong>From Expo:</strong> with <C>eas login</C> or <C>EXPO_TOKEN</C>, Android upload keystores and the App Store Connect key ids are imported.
              </li>
              <li>
                <strong>From this machine:</strong> eas.json submit settings, fastlane files, <C>~/.appstoreconnect/private_keys</C>, Downloads and Desktop.
              </li>
              <li>
                <strong>Created for you:</strong> a Google Play service account through <C>gcloud</C>, or guided downloads from Google Cloud and App Store Connect.
              </li>
              <li>
                <strong>Checked:</strong> each key is verified with Apple or Google before it is saved.
              </li>
            </ol>
            <div className={d.note}>
              <p>
                Keys are stored encrypted (AES-256-GCM). Apple and Google keys belong to the organization and only owners can add them; Android keystores belong to the
                project, one per package.
              </p>
            </div>
          </Section>

          <Section id='agent' title='Agents'>
            <p>Run the agent on each machine that should take builds started from the dashboard:</p>
            <CodeBlock
              code={`npx localxpo agent                      # serve this project
npx localxpo agent --dir ../other-app   # serve another project from the same machine
npx localxpo agent --list               # what this machine serves`}
            />
            <p>
              It checks in every few seconds and runs one job at a time with the regular CLI, so logs, limits and credentials behave as in a terminal. A Mac builds iOS and
              Android; Linux and Windows build Android. A build whose machine stops responding for three minutes is marked failed, and resumes if the machine comes back.
            </p>
          </Section>

          <Section id='ci' title='Run local Expo builds in CI'>
            <p>
              Create a token on <strong>CLI &amp; tokens</strong> in the dashboard, then skip <C>link</C> in CI or on a headless Mac:
            </p>
            <CodeBlock
              code={`LOCALXPO_TOKEN=lx_… npx localxpo build -p ios
LOCALXPO_NO_METRICS=1 npx localxpo build -p android    # turn machine metrics off`}
            />
            <p>
              The CLI talks to localxpo Cloud (<C>https://localxpo.app</C>) by default. Self-hosting? Add <C>LOCALXPO_URL=https://your-dashboard</C>, or run{' '}
              <C>npx localxpo link --url https://your-dashboard</C> once.
            </p>
          </Section>

          <Section id='env' title='Environment variables'>
            <p>
              Variables are set per project and per environment (development, preview, production) on the dashboard, and injected by the CLI. The environment follows the
              profile&apos;s <C>environment</C> in eas.json, otherwise the profile name. Secret values are hidden in the dashboard and removed from logs.
            </p>
          </Section>

          <Section id='metrics' title='Metrics and limits'>
            <p>
              During each build the CLI samples CPU, memory, memory pressure, swap, the heaviest build processes, power and free disk every 5 seconds, without sudo. The build
              page charts them per step, and the Machines page compares machines over 30 days.
            </p>
            <Table
              head={['Limit', 'Effect']}
              rows={[
                ['Gradle memory', <>Sets the Gradle and Kotlin daemon heaps, overriding <C>gradle.properties</C></>],
                ['Parallel workers', <>Gradle <C>--max-workers</C>, Xcode <C>-jobs</C></>],
                ['Low CPU priority', <>Build commands run under <C>nice</C>, so the machine stays responsive</>],
                ['Stop Gradle daemons', 'Gives their memory back when the build ends']
              ]}
            />
            <p>Limits are set on the Machines page, per machine or as a default, with values recommended for each machine&apos;s hardware.</p>
          </Section>

          <Section id='logs' title='Logs and errors'>
            <ul>
              <li>Every line is redacted on your machine first (keystore passwords, tokens, PEM blocks), then sent in batches every second.</li>
              <li>
                If the network drops, lines are queued and saved to <C>~/.localxpo/pending/</C>; the next command (or <C>localxpo sync</C>) uploads them.
              </li>
              <li>About 30 known Xcode, Gradle, CocoaPods and store failures are recognised and shown with what went wrong and how to fix it.</li>
            </ul>
          </Section>

          <Section id='api' title='REST API'>
            <p>
              Send a token with every request: <C>Authorization: Bearer lx_…</C>. Tokens are created on <strong>CLI &amp; tokens</strong>; the browser session also works for
              GET requests.
            </p>
            <CodeBlock lang='http' title='Example' code={`curl -H "Authorization: Bearer $LOCALXPO_TOKEN" \\
  "https://your-dashboard/api/v1/builds?projectId=…&status=success&limit=5"`} />
            <div className={d.table}>
              <table>
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map(e => (
                    <tr key={e.m + e.path}>
                      <td>
                        <span className={`${d.method} ${METHOD[e.m]}`}>{e.m}</span>
                        <C>{e.path}</C>
                      </td>
                      <td>{e.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id='self-host' title='Self-host the dashboard'>
            <p>
              The dashboard is open source (MIT). Without configuration it uses an embedded Postgres stored in <C>./data</C>; set <C>DATABASE_URL</C> to use your own.
            </p>
            <CodeBlock
              code={`pnpm install
pnpm dev                     # http://localhost:3000
pnpm build && pnpm start     # production`}
            />
            <Table
              head={['Variable', 'Purpose']}
              rows={[
                [<C key='a'>DATABASE_URL</C>, 'Postgres connection string; unset uses the embedded database'],
                [<C key='a'>LOCALXPO_SECRET</C>, 'Key that encrypts store credentials. Set it in production and back it up'],
                [<C key='a'>NEXT_PUBLIC_APP_URL</C>, 'Public URL shown in CLI commands'],
                [<C key='a'>LOCALXPO_DISABLE_SIGNUP</C>, <>Set to <C>1</C> to close registration</>]
              ]}
            />
            <div className={d.note}>
              <p>
                <strong>Most teams start on localxpo Cloud.</strong> It runs this same open-source code, kept up to date for you, with Pro features for teams. Self-hosting
                makes sense when the dashboard must stay on your network.
              </p>
            </div>
            <p>
              Prefer not to run a server? {cloud ? <Link href='/register'>Create a free localxpo Cloud account</Link> : 'localxpo Cloud hosts the dashboard for you'}; builds
              still run on your machines.
            </p>
          </Section>
        </main>
      </div>

      <footer className='border-t py-8 text-[14px]' style={{ borderColor: 'var(--rule)', color: 'var(--slate)' }}>
        <div className={`${s.wrap} flex flex-wrap items-center justify-between gap-4`}>
          <span className='flex items-center gap-2'>
            <Mark /> localxpo, open source under the MIT license
          </span>
          <nav className='flex gap-5' aria-label='Footer'>
            <Link href={user ? '/landing' : '/'} className='hover:text-[var(--ink)]'>
              Product
            </Link>
            {cloud && (
              <Link href='/pricing' className='hover:text-[var(--ink)]'>
                Pricing
              </Link>
            )}
            <Link href='/login' className='hover:text-[var(--ink)]'>
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default DocsPage
