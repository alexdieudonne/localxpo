// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import BuildsList, { type BuildsSearch } from '@/views/builds/builds-list'

// Lib Imports
import { requireOrg } from '@/lib/server/orgs'
import { listProjects } from '@/lib/server/projects'

export const metadata = { title: 'Activity' }
export const dynamic = 'force-dynamic'

const ActivityPage = async ({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<BuildsSearch> }) => {
  const { org } = await requireOrg((await params).org)

  return (
    <div className='space-y-6'>
      <PageHeader title='Activity' description='Every build in this organization, from every machine.' />
      <BuildsList
        orgId={org.id}
        basePath={`/${org.slug}/activity`}
        search={await searchParams}
        projects={(await listProjects(org.id)).map(p => ({ id: p.id, name: p.name }))}
        empty='No builds yet.'
      />
    </div>
  )
}

export default ActivityPage
