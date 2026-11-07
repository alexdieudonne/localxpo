// Next Imports
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Third-party Imports
import { BoxIcon, FileArchiveIcon, MonitorIcon, SendIcon, TagIcon, UserIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge, StatusBadge } from '@/components/builds/badges'
import CodeBlock from '@/components/shared/CodeBlock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import BuildLive from '@/views/builds/build-live'
import LiveResources from '@/views/builds/live-resources'
import RunInsights from '@/views/builds/run-insights'
import { SubmissionControls } from '@/views/jobs/run-controls'

// Lib Imports
import { formatDateTime } from '@/lib/format'
import { capacityLabel, capacityOf } from '@/lib/capacity'
import { getMachineLimits, getOrgDefaultLimits } from '@/lib/server/limits'
import { listMachines } from '@/lib/server/metrics'
import { requireProject } from '@/lib/server/scope'
import { getSubmission, getSubmissionIssues, isSubmissionFinished } from '@/lib/server/submissions'

export const dynamic = 'force-dynamic'

type Params = Promise<{ org: string; project: string; id: string }>

export const generateMetadata = async ({ params }: { params: Params }) => {
  const p = await params
  const { org } = await requireProject(p.org, p.project)
  const sub = await getSubmission(org.id, p.id)

  return { title: sub ? `Submission · ${sub.destination}` : 'Submission' }
}

const Meta = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className='flex min-w-0 items-start gap-2.5'>
    <span className='text-muted-foreground mt-0.5 [&_svg]:size-4'>{icon}</span>
    <div className='min-w-0'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <div className='truncate text-sm font-medium'>{children}</div>
    </div>
  </div>
)

const SubmissionPage = async ({ params }: { params: Params }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)
  const sub = await getSubmission(org.id, p.id)

  if (!sub || sub.project_id !== project.id) notFound()

  const store = sub.platform === 'ios' ? 'App Store Connect' : 'Google Play'

  // "Limit this machine" from the log view: its limits, the org default, and its capacity for the checks.
  const machineStats = sub.machine ? (await listMachines(org.id)).find(m => m.name === sub.machine) : undefined

  const limitTarget = sub.machine
    ? {
        orgSlug: org.slug,
        machine: sub.machine,
        own: await getMachineLimits(org.id, sub.machine),
        orgDefault: await getOrgDefaultLimits(org.id),
        capacity: machineStats ? capacityOf(machineStats) : null,
        capacityLabel: machineStats ? capacityLabel(machineStats) : undefined
      }
    : null

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-2xl font-semibold'>{sub.destination}</h1>
            <StatusBadge status={sub.status} kind='submission' />
          </div>
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-sm'>
            <PlatformBadge platform={sub.platform} />
            <span>Started {formatDateTime(sub.created_at)}</span>
          </div>
        </div>
        <SubmissionControls
          orgSlug={org.slug}
          submissionId={sub.id}
          running={!isSubmissionFinished(sub.status)}
          stopping={Boolean(sub.cancel_requested_at)}
          canRetry={(sub.status === 'failed' || sub.status === 'canceled') && Boolean(sub.build_id)}
        />
      </div>

      {sub.status === 'success' && (
        <Alert className='border-emerald-500/30 bg-emerald-500/5'>
          <SendIcon />
          <AlertTitle>Uploaded to {store}</AlertTitle>
          <AlertDescription>
            {sub.platform === 'ios'
              ? 'Apple processes the build for 5–30 minutes before it appears in TestFlight.'
              : 'Google may take a few minutes to process it before testers get it.'}
          </AlertDescription>
        </Alert>
      )}

      {sub.error_message && sub.status !== 'success' && (
        <Alert variant='destructive'>
          <AlertTitle>{sub.lost_at ? 'The upload machine stopped responding' : 'Upload failed'}</AlertTitle>
          <AlertDescription>{sub.error_message}</AlertDescription>
        </Alert>
      )}

      <Card size='sm'>
        <CardContent className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          <Meta icon={<BoxIcon />} label='Build'>
            {sub.build_id ? (
              <Link href={`${base}/builds/${sub.build_id}`} className='hover:underline'>
                #{sub.build_number_seq}
              </Link>
            ) : (
              'Uploaded from a file'
            )}
          </Meta>
          <Meta icon={<TagIcon />} label='Version'>
            {sub.app_version ?? '—'}
            {sub.build_number ? <span className='text-muted-foreground'> ({sub.build_number})</span> : null}
          </Meta>
          <Meta icon={<FileArchiveIcon />} label='File'>
            <span className='font-mono text-xs'>{sub.artifact_name ?? '—'}</span>
          </Meta>
          <Meta icon={<MonitorIcon />} label='Machine'>
            {sub.machine ?? 'unknown'}
          </Meta>
          <Meta icon={<UserIcon />} label='By'>
            {sub.submitted_by ?? '—'}
          </Meta>
        </CardContent>
      </Card>

      {sub.status === 'failed' && sub.build_id && (
        <Card size='sm'>
          <CardContent className='space-y-2'>
            <p className='text-sm font-medium'>Retry after fixing the cause, from the machine that has the file:</p>
            <CodeBlock code={`npx localxpo submit --build=${sub.build_id}`} />
          </CardContent>
        </Card>
      )}

      <LiveResources kind='submissions' runId={sub.id} running={!isSubmissionFinished(sub.status)} target={limitTarget} />

      <BuildLive
        kind='submissions'
        buildId={sub.id}
        initialStatus={sub.status}
        initialSteps={[]}
        initialIssues={getSubmissionIssues(sub)}
        startedAt={sub.created_at}
        finishedAt={sub.finished_at}
      />

      <RunInsights kind='submissions' runId={sub.id} running={!isSubmissionFinished(sub.status)} />
    </div>
  )
}

export default SubmissionPage
