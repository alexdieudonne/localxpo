// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowRightIcon } from 'lucide-react'

// Component Imports
import { StatusBadge } from '@/components/builds/badges'
import BuildsTable from '@/components/builds/builds-table'
import EntityAvatar from '@/components/shared/EntityAvatar'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GettingStarted from '@/views/dashboard/getting-started'
import StatCards from '@/views/dashboard/stat-cards'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { getBuildStats, listBuilds } from '@/lib/server/builds'
import { requireOrg } from '@/lib/server/orgs'
import { listProjects } from '@/lib/server/projects'
import { getServerUrl } from '@/lib/server/request-url'

export const dynamic = 'force-dynamic'

export const generateMetadata = async ({ params }: { params: Promise<{ org: string }> }) => ({ title: (await params).org })

const OrgProjectsPage = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { org } = await requireOrg((await params).org)
  const projects = await listProjects(org.id)
  const stats = await getBuildStats({ orgId: org.id }, 30)
  const { rows: recent } = await listBuilds(org.id, { limit: 6 })

  return (
    <div className='space-y-6'>
      <PageHeader title='Projects' description={`Apps in ${org.name}. A project appears when you run npx localxpo link in an Expo app.`} />

      {projects.length === 0 ? (
        <GettingStarted serverUrl={await getServerUrl()} orgSlug={org.slug} />
      ) : (
        <>
          <StatCards stats={stats} />

          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {projects.map(p => (
              <Link key={p.id} href={`/${org.slug}/projects/${p.slug}`} className='group'>
                <Card className='group-hover:ring-primary/40 h-full transition'>
                  <CardHeader>
                    <div className='flex items-start gap-3'>
                      <EntityAvatar name={p.name} kind='project' className='size-9' />
                      <div className='min-w-0 flex-1'>
                        <CardTitle className='truncate group-hover:underline'>{p.name}</CardTitle>
                        <CardDescription className='truncate font-mono text-xs'>{p.slug}</CardDescription>
                      </div>
                      {p.last_status && <StatusBadge status={p.last_status} />}
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-1.5 text-sm'>
                    <Row label='iOS' value={p.ios_bundle_id} />
                    <Row label='Android' value={p.android_package} />
                    <Row label='Version' value={p.app_version} />
                    <p className='text-muted-foreground pt-2 text-xs'>
                      {p.build_count} build{p.build_count === 1 ? '' : 's'}
                      {p.last_build_at ? ` · last ${timeAgo(p.last_build_at)}` : ''}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {recent.length > 0 && (
            <Card className='gap-0 pb-0'>
              <CardHeader className='pb-4'>
                <CardTitle>Latest activity</CardTitle>
                <CardAction>
                  <Button variant='ghost' size='sm' render={<Link href={`/${org.slug}/activity`} />} nativeButton={false}>
                    All builds <ArrowRightIcon />
                  </Button>
                </CardAction>
              </CardHeader>
              <BuildsTable builds={recent} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string | null }) => (
  <div className='flex justify-between gap-3'>
    <span className='text-muted-foreground'>{label}</span>
    <span className='truncate font-mono text-xs'>{value ?? '—'}</span>
  </div>
)

export default OrgProjectsPage
