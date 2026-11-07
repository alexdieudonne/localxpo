// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'

// Component Imports
import BuildsTable from '@/components/builds/builds-table'
import CodeBlock from '@/components/shared/CodeBlock'
import EntityAvatar from '@/components/shared/EntityAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { listBuilds } from '@/lib/server/builds'
import { requireProject, type ProjectParams } from '@/lib/server/scope'
import { listSubmissions } from '@/lib/server/submissions'
import { validateExpoConfig } from '@/lib/server/validate-config'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const generateMetadata = async ({ params }: { params: ProjectParams }) => ({ title: decodeURIComponent((await params).project) })

const parse = (s: string | null) => {
  try {
    return s ? (JSON.parse(s) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const ProjectOverviewPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)
  const config = parse(project.config_json)
  const eas = parse(project.eas_json)
  const checks = validateExpoConfig(config, eas)
  const { rows: builds, total } = await listBuilds(org.id, { projectId: project.id, limit: 8 })
  const lastSubmission = (await listSubmissions(project.id, 1))[0]
  const problems = checks.filter(c => c.level !== 'ok').length
  const profiles = Object.keys((eas?.build as Record<string, unknown>) ?? {})

  const latest = (platform: string) => builds.find(b => b.platform === platform)

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <EntityAvatar name={project.name} kind='project' className='size-12 text-xl' />
        <div className='min-w-0'>
          <h1 className='truncate text-2xl font-semibold'>{project.name}</h1>
          <p className='text-muted-foreground font-mono text-sm'>
            {org.slug}/{project.slug}
            {project.sdk_version ? ` · SDK ${project.sdk_version}` : ''} · config synced {timeAgo(project.updated_at)}
          </p>
        </div>
      </div>

      {/* At a glance */}
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {(['ios', 'android'] as const).map(platform => {
          const b = latest(platform)

          return (
            <Card key={platform} size='sm'>
              <CardContent className='space-y-1'>
                <p className='text-muted-foreground text-sm'>Latest {platform === 'ios' ? 'iOS' : 'Android'} build</p>
                {b ? (
                  <Link href={`${base}/builds/${b.id}`} className='block hover:underline'>
                    <p className={cn('text-lg font-semibold', b.status === 'failed' && 'text-destructive', b.status === 'success' && 'text-emerald-600 dark:text-emerald-400')}>
                      #{b.number} · {b.status === 'in_progress' ? 'building' : b.status}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {b.app_version ?? ''} {b.profile} · {timeAgo(b.created_at)}
                    </p>
                  </Link>
                ) : (
                  <p className='text-muted-foreground text-lg'>—</p>
                )}
              </CardContent>
            </Card>
          )
        })}
        <Card size='sm'>
          <CardContent className='space-y-1'>
            <p className='text-muted-foreground text-sm'>Latest submission</p>
            {lastSubmission ? (
              <Link href={`${base}/submissions`} className='block hover:underline'>
                <p className='text-lg font-semibold'>{lastSubmission.destination}</p>
                <p className='text-muted-foreground text-xs'>
                  {lastSubmission.status === 'in_progress' ? 'uploading' : lastSubmission.status} · {timeAgo(lastSubmission.created_at)}
                </p>
              </Link>
            ) : (
              <p className='text-muted-foreground text-lg'>—</p>
            )}
          </CardContent>
        </Card>
        <Card size='sm'>
          <CardContent className='space-y-1'>
            <p className='text-muted-foreground text-sm'>Version</p>
            <p className='text-lg font-semibold'>{project.app_version ?? '—'}</p>
            <p className='text-muted-foreground truncate text-xs'>{profiles.length ? `profiles: ${profiles.join(', ')}` : 'no eas.json'}</p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 xl:grid-cols-3'>
        <Card className='xl:col-span-2'>
          <CardHeader>
            <CardTitle>Config checks</CardTitle>
            <CardDescription>
              {problems === 0 ? 'Nothing to fix.' : `${problems} thing${problems > 1 ? 's' : ''} to look at before submitting.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='divide-y'>
              {checks.map(c => (
                <li key={c.title} className='flex gap-3 py-2.5 first:pt-0 last:pb-0'>
                  {c.level === 'ok' ? (
                    <CircleCheckIcon className='mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400' />
                  ) : c.level === 'warning' ? (
                    <TriangleAlertIcon className='mt-0.5 size-4 shrink-0 text-amber-500' />
                  ) : (
                    <CircleAlertIcon className='text-destructive mt-0.5 size-4 shrink-0' />
                  )}
                  <div className='min-w-0'>
                    <p className={cn('text-sm font-medium', c.level === 'ok' && 'font-normal')}>{c.title}</p>
                    {c.level !== 'ok' && <p className='text-muted-foreground text-sm'>{c.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build it</CardTitle>
            <CardDescription>From the project folder, after <code className='font-mono'>npx localxpo link</code>.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <CodeBlock code={`npx localxpo build -p ios --profile ${profiles.includes('production') ? 'production' : (profiles[0] ?? 'production')}`} />
            <CodeBlock code={`npx localxpo build -p android --profile ${profiles.includes('preview') ? 'preview' : (profiles[0] ?? 'production')}`} />
            <p className='text-muted-foreground text-xs'>
              Add <code className='font-mono'>--submit</code> to upload to TestFlight / Google Play when the build succeeds.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className='gap-0 pb-0'>
        <CardHeader className='pb-4'>
          <CardTitle>Recent builds</CardTitle>
          <CardDescription>{total} total</CardDescription>
          <CardAction>
            <Button variant='ghost' size='sm' render={<Link href={`${base}/builds`} />} nativeButton={false}>
              All builds <ArrowRightIcon />
            </Button>
          </CardAction>
        </CardHeader>
        {builds.length ? (
          <BuildsTable builds={builds} showProject={false} />
        ) : (
          <p className='text-muted-foreground border-t p-8 text-center text-sm'>No builds for this project yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Synced configuration</CardTitle>
          <CardDescription>
            The evaluated output of <code className='font-mono'>npx expo config</code> and your eas.json, as of the last sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='app'>
            <TabsList>
              <TabsTrigger value='app'>App config</TabsTrigger>
              <TabsTrigger value='eas'>eas.json</TabsTrigger>
            </TabsList>
            <TabsContent value='app' className='pt-3'>
              <CodeBlock className='max-h-[480px] overflow-auto' code={config ? JSON.stringify(config, null, 2) : '// not synced yet'} />
            </TabsContent>
            <TabsContent value='eas' className='pt-3'>
              <CodeBlock className='max-h-[480px] overflow-auto' code={eas ? JSON.stringify(eas, null, 2) : '// no eas.json found'} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProjectOverviewPage
