// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import BuildsList, { type BuildsSearch } from '@/views/builds/builds-list'
import NewBuildDialog from '@/views/jobs/new-build-dialog'
import PendingJobs from '@/views/jobs/pending-jobs'

// Lib Imports
import { agentChoices, pendingJobsView, profilesOf } from '@/lib/server/jobs'
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Builds' }
export const dynamic = 'force-dynamic'

const ProjectBuildsPage = async ({ params, searchParams }: { params: ProjectParams; searchParams: Promise<BuildsSearch> }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Builds'
        description={`Every build of ${project.name}, from every machine.`}
        actions={<NewBuildDialog orgSlug={org.slug} projectId={project.id} profiles={profilesOf(project.eas_json)} agents={await agentChoices(org.id, project.id)} />}
      />
      <PendingJobs orgSlug={org.slug} base={base} jobs={await pendingJobsView(org.id, project.id)} />
      <BuildsList
        orgId={org.id}
        basePath={`${base}/builds`}
        search={await searchParams}
        fixed={{ projectId: project.id }}
        showProject={false}
        empty={
          <>
            No builds yet. Click <b>New build</b> (with <code className='bg-muted rounded px-1.5 py-0.5 font-mono'>npx localxpo agent</code>{' '}
            running on a machine), or run <code className='bg-muted rounded px-1.5 py-0.5 font-mono'>npx localxpo build -p android</code> in
            the project folder.
          </>
        }
      />
    </div>
  )
}

export default ProjectBuildsPage
