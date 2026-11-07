// Next Imports
import Link from 'next/link'

// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const steps = (serverUrl: string, orgSlug?: string) => [
  {
    title: 'Link your Expo project',
    body: 'Nothing to install: npx downloads the CLI. It signs you in, picks this organization and creates the project from app.json.',
    code: `cd ~/path/to/your-expo-app\nnpx localxpo link --url ${serverUrl}${orgSlug ? ` --org ${orgSlug}` : ''}`
  },
  {
    title: 'Check your machine',
    body: 'Verifies Node, fastlane, Java, the Android SDK, Xcode and CocoaPods before you lose 10 minutes to a missing tool.',
    code: 'npx localxpo doctor'
  },
  {
    title: 'Run a build',
    body: 'Runs on your machine with fastlane. Logs stream here live and errors are explained in plain language.',
    code: 'npx localxpo build -p android --profile preview'
  }
]

const GettingStarted = ({ serverUrl, orgSlug, compact = false }: { serverUrl: string; orgSlug?: string; compact?: boolean }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Connect your first app</CardTitle>
        <CardDescription>
          Three commands, run in your Expo project. Builds run for free on your own Mac or PC; this dashboard only stores logs and statuses. Add
          your store keys on the{' '}
          <Link href={orgSlug ? `/${orgSlug}/credentials` : '/'} className='text-foreground underline underline-offset-4'>
            Credentials
          </Link>{' '}
          page to sign and upload automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className={compact ? 'grid gap-5' : 'grid gap-5 lg:grid-cols-3'}>
          {steps(serverUrl, orgSlug).map((s, i) => (
            <li key={s.title} className='flex gap-3'>
              <span className='bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                {i + 1}
              </span>
              <div className='min-w-0 flex-1 space-y-2'>
                <div>
                  <p className='font-medium'>{s.title}</p>
                  <p className='text-muted-foreground text-sm'>{s.body}</p>
                </div>
                <CodeBlock code={s.code} />
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

export default GettingStarted
