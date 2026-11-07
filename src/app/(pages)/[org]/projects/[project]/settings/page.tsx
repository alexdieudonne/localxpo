// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SavedCredential from '@/views/credentials/saved-credential'
import DeleteProjectButton from '@/views/projects/delete-project-button'
import RenameProjectForm from '@/views/projects/rename-project-form'

// Lib Imports
import { formatDateTime } from '@/lib/format'
import { listCredentials } from '@/lib/server/credentials'
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Project settings' }

const ProjectSettingsPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { org, project } = await requireProject(p.org, p.project)
  const keystore = (await listCredentials(org.id, project.id)).find(c => c.kind === 'android_keystore')
  const isOwner = org.role === 'owner'

  return (
    <div className='max-w-3xl space-y-6'>
      <PageHeader title='Settings' description={`Created ${formatDateTime(project.created_at)}`} />

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>The display name is free to change. The slug comes from &quot;slug&quot; in app.json: that is how the CLI finds this project.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <RenameProjectForm orgSlug={org.slug} projectId={project.id} name={project.name} />
          <dl className='grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]'>
            <dt className='text-muted-foreground'>Slug</dt>
            <dd className='font-mono'>{project.slug}</dd>
            <dt className='text-muted-foreground'>Project ID</dt>
            <dd className='font-mono'>{project.id}</dd>
            <dt className='text-muted-foreground'>iOS bundle ID</dt>
            <dd className='font-mono'>{project.ios_bundle_id ?? '—'}</dd>
            <dt className='text-muted-foreground'>Android package</dt>
            <dd className='font-mono'>{project.android_package ?? '—'}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Android upload keystore</CardTitle>
          <CardDescription>Unique to this app. Apple and Google keys are shared at the organization level (Credentials).</CardDescription>
        </CardHeader>
        <CardContent>
          {keystore ? (
            <SavedCredential
              c={keystore}
              orgSlug={org.slug}
              canDelete={isOwner}
              lines={[
                ['Alias', keystore.meta.keyAlias],
                ['SHA-1', keystore.meta.sha1 ?? '—'],
                ['SHA-256', keystore.meta.sha256 ?? '—']
              ]}
              warning='Delete this keystore backup? If it is also lost on your machine, you will need Google Play support to reset your upload key.'
            />
          ) : (
            <p className='text-muted-foreground text-sm'>Created automatically on the first Android release build.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Use this project from the CLI</CardTitle>
          <CardDescription>In the project folder: writes localxpo.json (commit it) so every machine builds into this project.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <CodeBlock code={`npx localxpo link --org ${org.slug}`} />
        </CardContent>
      </Card>

      {isOwner && (
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle>Delete project</CardTitle>
            <CardDescription>Deletes all builds, logs, submissions, environment variables and the keystore backup. Your code is untouched.</CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteProjectButton orgSlug={org.slug} projectId={project.id} name={project.name} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ProjectSettingsPage
