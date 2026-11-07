// Next Imports
import Link from 'next/link'

// Third-party Imports
import { SendIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge, StatusBadge } from '@/components/builds/badges'
import CodeBlock from '@/components/shared/CodeBlock'
import PageHeader from '@/components/shared/PageHeader'
import PendingJobs from '@/views/jobs/pending-jobs'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Lib Imports
import { formatDuration, timeAgo } from '@/lib/format'
import { requireProject, type ProjectParams } from '@/lib/server/scope'
import { pendingJobsView } from '@/lib/server/jobs'
import { listSubmissions } from '@/lib/server/submissions'

export const metadata = { title: 'Submissions' }
export const dynamic = 'force-dynamic'

const SubmissionsPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)
  const rows = await listSubmissions(project.id)

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Submissions'
        description='Every upload to App Store Connect (TestFlight) and Google Play, each with its own live logs. Started from a build page (Submit), by `build --submit`, or with `npx localxpo submit`.'
      />
      <PendingJobs orgSlug={org.slug} base={base} jobs={await pendingJobsView(org.id, project.id, 'submit')} />

      <Card size='sm'>
        <CardContent className='grid gap-4 md:grid-cols-[1fr_auto] md:items-center'>
          <div>
            <p className='font-medium'>Submit an existing build</p>
            <p className='text-muted-foreground text-sm'>
              Lists your successful store builds whose .ipa / .aab is on the machine you run it from, and uploads the one you pick.
            </p>
          </div>
          <div className='grid gap-2 md:min-w-96'>
            <CodeBlock code='npx localxpo submit' />
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <SendIcon className='text-muted-foreground size-10' />
            <p className='font-medium'>Nothing submitted yet</p>
            <p className='text-muted-foreground max-w-md text-sm'>
              Add your App Store Connect key or Google service account on{' '}
              <Link href={`/${org.slug}/credentials`} className='text-foreground underline'>
                Credentials
              </Link>
              , then build with <code className='font-mono'>--submit</code>.
            </p>
            <CodeBlock code='npx localxpo build -p ios --profile production --submit' className='w-full max-w-md text-left' />
          </CardContent>
        </Card>
      ) : (
        <Card className='gap-0 py-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[140px]'>Status</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className='max-md:hidden'>Build</TableHead>
                <TableHead className='max-lg:hidden'>By</TableHead>
                <TableHead className='text-right max-md:hidden'>Took</TableHead>
                <TableHead className='text-right'>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(s => (
                <TableRow key={s.id} className='group relative'>
                  <TableCell>
                    <Link href={`${base}/submissions/${s.id}`} className='absolute inset-0' aria-label={`Open submission to ${s.destination}`} />
                    <StatusBadge status={s.status} kind='submission' />
                  </TableCell>
                  <TableCell>
                    <p className='font-medium group-hover:underline'>{s.destination}</p>
                    {s.error_message && <p className='text-destructive max-w-md truncate text-xs' title={s.error_message}>{s.error_message}</p>}
                  </TableCell>
                  <TableCell>
                    <PlatformBadge platform={s.platform} />
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {s.app_version ?? '—'}
                    {s.build_number ? ` (${s.build_number})` : ''}
                  </TableCell>
                  <TableCell className='max-md:hidden'>
                    {s.build_id ? (
                      <Link href={`${base}/builds/${s.build_id}`} className='relative z-10 text-sm hover:underline'>
                        #{s.build_number_seq}
                      </Link>
                    ) : (
                      <span className='text-muted-foreground text-xs'>file</span>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm max-lg:hidden'>{s.submitted_by ?? '—'}</TableCell>
                  <TableCell className='text-right font-mono text-xs tabular-nums max-md:hidden'>
                    {s.finished_at ? formatDuration(s.finished_at - s.created_at) : '—'}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-right text-xs whitespace-nowrap'>{timeAgo(s.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export default SubmissionsPage
