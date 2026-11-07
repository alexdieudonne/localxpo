// Component Imports
import EntityAvatar from '@/components/shared/EntityAvatar'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddMemberForm, MemberActions } from '@/views/orgs/member-forms'
import PlanUsage from '@/views/billing/plan-usage'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { listMembers, requireOrg } from '@/lib/server/orgs'

export const metadata = { title: 'Members' }
export const dynamic = 'force-dynamic'

const MembersPage = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { user, org } = await requireOrg((await params).org)
  const members = await listMembers(org.id)
  const isOwner = org.role === 'owner'

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Members'
        description='Members see every project, build and log in this organization, and their CLI can use its store credentials. Owners also manage members, credentials and settings.'
        actions={<PlanUsage org={org} kind='members' />}
      />

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Add a member</CardTitle>
            <CardDescription>They need a localxpo account on this server first (they can register at /register).</CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberForm orgSlug={org.slug} />
          </CardContent>
        </Card>
      )}

      <Card className='gap-0 py-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className='max-sm:hidden'>Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(m => (
              <TableRow key={m.user_id}>
                <TableCell>
                  <div className='flex items-center gap-3'>
                    <EntityAvatar name={m.name} kind='project' className='size-8' />
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>
                        {m.name}
                        {m.user_id === user.id && <span className='text-muted-foreground font-normal'> (you)</span>}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>{m.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === 'owner' ? 'default' : 'secondary'} className='capitalize'>
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground text-sm max-sm:hidden'>{timeAgo(m.created_at)}</TableCell>
                <TableCell className='text-right'>
                  {(isOwner || m.user_id === user.id) && (
                    <MemberActions orgSlug={org.slug} member={{ userId: m.user_id, name: m.name, role: m.role }} isSelf={m.user_id === user.id} canManage={isOwner} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export default MembersPage
