// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteOrgButton, OrgSettingsForm } from '@/views/orgs/org-settings-forms'

// Lib Imports
import { formatDateTime } from '@/lib/format'
import { listOrgsForUser, requireOrg } from '@/lib/server/orgs'

export const metadata = { title: 'Organization settings' }

const OrgSettingsPage = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { user, org } = await requireOrg((await params).org)
  const isOwner = org.role === 'owner'
  const canDelete = isOwner && (await listOrgsForUser(user.id)).length > 1

  return (
    <div className='space-y-6'>
      <PageHeader title='Settings' description={`Created ${formatDateTime(org.created_at)}`} />

      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>{isOwner ? 'Changing the URL breaks old links and `--org` flags in scripts.' : 'Only owners can change these.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrgSettingsForm orgSlug={org.slug} name={org.name} disabled={!isOwner} />
        </CardContent>
      </Card>

      {isOwner && (
        <Card className='border-destructive/40 max-w-2xl'>
          <CardHeader>
            <CardTitle>Delete organization</CardTitle>
            <CardDescription>
              Deletes every project, build, log, submission and store credential in {org.name}.{' '}
              {!canDelete && 'You need at least one other organization first.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteOrgButton orgSlug={org.slug} name={org.name} disabled={!canDelete} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default OrgSettingsPage
