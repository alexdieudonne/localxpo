// Third-party Imports
import { SmartphoneIcon } from 'lucide-react'

// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import BuildsList, { type BuildsSearch } from '@/views/builds/builds-list'

// Lib Imports
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Development builds' }
export const dynamic = 'force-dynamic'

const DevelopmentBuildsPage = async ({ params, searchParams }: { params: ProjectParams; searchParams: Promise<BuildsSearch> }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)
  const eas = project.eas_json ? (JSON.parse(project.eas_json) as { build?: Record<string, { developmentClient?: boolean }> }) : null
  const devProfile = Object.entries(eas?.build ?? {}).find(([, v]) => v?.developmentClient)?.[0]

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Development builds'
        description='Builds that include expo-dev-client: install once on your device or simulator, then load JavaScript from your laptop with `npx expo start`. Rebuild only when the native fingerprint changes.'
      />

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <SmartphoneIcon className='size-4' /> Make one
            </CardTitle>
            <CardDescription>
              {devProfile ? (
                <>
                  Your eas.json profile <code className='font-mono'>{devProfile}</code> has <code className='font-mono'>developmentClient: true</code>.
                </>
              ) : (
                <>
                  Add a profile with <code className='font-mono'>&quot;developmentClient&quot;: true</code> to eas.json, and{' '}
                  <code className='font-mono'>npx expo install expo-dev-client</code>.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <CodeBlock code={`npx localxpo build -p android --profile ${devProfile ?? 'development'}`} />
            <CodeBlock code={`npx localxpo build -p ios --profile ${devProfile ?? 'development'}`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Install it</CardTitle>
            <CardDescription>The CLI leaves the file in localxpo-output/ on the machine that built it.</CardDescription>
          </CardHeader>
          <CardContent className='text-muted-foreground space-y-2 text-sm'>
            <p>
              <span className='text-foreground font-medium'>Android:</span> <code className='font-mono'>adb install localxpo-output/*.apk</code>, or
              send the .apk to your phone.
            </p>
            <p>
              <span className='text-foreground font-medium'>iOS simulator:</span> set <code className='font-mono'>&quot;ios&quot;: {'{'} &quot;simulator&quot;: true {'}'}</code>{' '}
              in the profile, untar the .app and drag it onto the simulator.
            </p>
            <p>
              <span className='text-foreground font-medium'>iOS device:</span> use an internal distribution profile; register the device in your
              Apple Developer account first.
            </p>
          </CardContent>
        </Card>
      </div>

      <BuildsList
        orgId={org.id}
        basePath={`${base}/development-builds`}
        search={await searchParams}
        fixed={{ projectId: project.id, devClient: true }}
        showProject={false}
        empty='No development builds yet.'
      />
    </div>
  )
}

export default DevelopmentBuildsPage
