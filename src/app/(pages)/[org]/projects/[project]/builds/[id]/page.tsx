// Next Imports
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Third-party Imports
import { CloudUploadIcon, FingerprintIcon, FolderOutputIcon, GitBranchIcon, MonitorIcon, TagIcon, TerminalIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge, StatusBadge } from '@/components/builds/badges'
import { displayStatus } from '@/components/builds/builds-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import CodeBlock from '@/components/shared/CodeBlock'
import BuildActions from '@/views/builds/build-actions'
import { BuildControls } from '@/views/jobs/run-controls'
import BuildLive from '@/views/builds/build-live'
import LiveResources from '@/views/builds/live-resources'
import RunInsights from '@/views/builds/run-insights'

// Lib Imports
import { formatDateTime, shortSha } from '@/lib/format'
import { capacityLabel, capacityOf } from '@/lib/capacity'
import { agentsForProject, uploadStepFor } from '@/lib/server/jobs'
import { getMachineLimits, getOrgDefaultLimits } from '@/lib/server/limits'
import { listMachines } from '@/lib/server/metrics'
import { requireProject } from '@/lib/server/scope'
import { listSubmissionsForBuild } from '@/lib/server/submissions'
import { getBuild, getIssues, getSteps, isFinished } from '@/lib/server/builds'
import { db } from '@/lib/server/db'

export const dynamic = 'force-dynamic'

type Params = Promise<{ org: string; project: string; id: string }>

export const generateMetadata = async ({ params }: { params: Params }) => {
  const p = await params
  const { org } = await requireProject(p.org, p.project)
  const build = await getBuild(org.id, p.id)

  return { title: build ? `${build.project_name} #${build.number}` : 'Build' }
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

const BuildPage = async ({ params }: { params: Params }) => {
  const p = await params
  const { org, project, base } = await requireProject(p.org, p.project)
  const id = p.id
  const build = await getBuild(org.id, id)

  if (!build || build.project_id !== project.id) notFound()

  const lastLog = (await db.one('SELECT MAX(ts) AS ts FROM build_logs WHERE build_id = ?', id)) as { ts: number | null }
  const status = displayStatus(build, lastLog.ts ?? undefined)
  const submissions = await listSubmissionsForBuild(build.id)

  // Store builds that finished but were never uploaded successfully can be submitted later.
  const storeBuild =
    build.status === 'success' &&
    !build.dev_client &&
    build.distribution !== 'internal' &&
    build.distribution !== 'simulator' &&
    (build.platform === 'ios' ? build.artifact_path?.endsWith('.ipa') : build.artifact_path?.endsWith('.aab'))

  const canSubmitLater = Boolean(storeBuild) && !submissions.some(s => s.status === 'success' || s.status === 'in_progress')

  // "Limit this machine" from the log view: its limits, the org default, and its capacity for the checks.
  const machineStats = build.machine ? (await listMachines(org.id)).find(m => m.name === build.machine) : undefined

  const limitTarget = build.machine
    ? {
        orgSlug: org.slug,
        machine: build.machine,
        own: await getMachineLimits(org.id, build.machine),
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
            <h1 className='text-2xl font-semibold'>
              <Link href={base} className='hover:underline'>
                {build.project_name}
              </Link>{' '}
              <span className='text-muted-foreground font-normal'>#{build.number}</span>
            </h1>
            <StatusBadge status={status} />
          </div>
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-sm'>
            <PlatformBadge platform={build.platform} />
            <span className='rounded-md border px-2 py-0.5 font-mono text-xs'>{build.profile}</span>
            <span>Started {formatDateTime(build.started_at)}</span>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <BuildControls
            orgSlug={org.slug}
            buildId={build.id}
            running={!isFinished(build.status)}
            stopping={Boolean(build.cancel_requested_at)}
            canSubmit={canSubmitLater}
            platform={build.platform}
            agentOnline={(await agentsForProject(org.id, build.project_id)).some(a => a.machine === build.machine && a.online)}
          />
          <BuildActions orgSlug={org.slug} buildId={build.id} running={!isFinished(build.status)} />
        </div>
      </div>

      {status === 'stale' && (
        <Alert>
          <AlertTitle>No news from the build machine for 30 minutes</AlertTitle>
          <AlertDescription>
            The laptop may have gone to sleep or the CLI was killed. Logs buffered on that machine are uploaded the next
            time you run any localxpo command there. You can also mark this build as canceled.
          </AlertDescription>
        </Alert>
      )}

      {build.error_message && build.status !== 'success' && (
        <Alert variant='destructive'>
          <AlertTitle>{build.status === 'canceled' ? 'Canceled' : build.lost_at ? 'The build machine stopped responding' : 'Build failed'}</AlertTitle>
          <AlertDescription>{build.error_message}</AlertDescription>
        </Alert>
      )}

      <Card size='sm'>
        <CardContent className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7'>
          <Meta icon={<TagIcon />} label='Version'>
            {build.app_version ?? '—'}
            {build.build_number ? <span className='text-muted-foreground'> ({build.build_number})</span> : null}
          </Meta>
          <Meta icon={<GitBranchIcon />} label='Source'>
            {build.git_branch ?? '—'} <span className='text-muted-foreground font-mono'>{shortSha(build.git_commit)}</span>
            {build.git_dirty ? <span className='text-amber-600' title='Built with uncommitted changes'> · dirty</span> : null}
          </Meta>
          <Meta icon={<MonitorIcon />} label={build.started_by ? `Machine · ${build.started_by}` : 'Machine'}>
            {build.machine ?? 'unknown'}
          </Meta>
          <Meta icon={<TerminalIcon />} label='CLI'>
            {build.cli_version ? `v${build.cli_version}` : '—'}
          </Meta>
          <Meta icon={<FolderOutputIcon />} label='Artifact (on build machine)'>
            <span className='font-mono text-xs' title={build.artifact_path ?? undefined}>
              {build.artifact_path ? build.artifact_path.split('/').slice(-2).join('/') : '—'}
            </span>
          </Meta>
          <Meta icon={<FingerprintIcon />} label='Native fingerprint'>
            {build.fingerprint ? (
              <Link href={`${base}/fingerprints#${build.fingerprint}`} className='font-mono text-xs hover:underline'>
                {build.fingerprint.slice(0, 12)}
              </Link>
            ) : (
              '—'
            )}
            {build.dev_client ? <span className='text-muted-foreground'> · dev client</span> : null}
          </Meta>
          <Meta icon={<CloudUploadIcon />} label='Store upload'>
            {build.submitted ? (build.platform === 'ios' ? 'Sent to App Store Connect' : 'Sent to Google Play') : submissions.some(s => s.status === 'in_progress') ? 'Uploading…' : 'Not uploaded'}
          </Meta>
        </CardContent>
      </Card>

      {(submissions.length > 0 || canSubmitLater) && (
        <Card size='sm'>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='font-medium'>Submissions</p>
              {canSubmitLater && <span className='text-muted-foreground text-xs'>Run on {build.machine ?? 'the machine that built it'}:</span>}
            </div>
            {submissions.map(s => (
              <Link
                key={s.id}
                href={`${base}/submissions/${s.id}`}
                className='hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'
              >
                <span className='flex items-center gap-3'>
                  <StatusBadge status={s.status} kind='submission' />
                  <span className='font-medium'>{s.destination}</span>
                </span>
                <span className='text-muted-foreground text-xs'>{formatDateTime(s.created_at)}</span>
              </Link>
            ))}
            {canSubmitLater && <CodeBlock code={`npx localxpo submit --build=${build.id}`} />}
          </CardContent>
        </Card>
      )}

      <LiveResources kind='builds' runId={build.id} running={!isFinished(build.status)} target={limitTarget} cliVersion={build.cli_version} />

      <BuildLive
        buildId={build.id}
        initialStatus={build.status}
        initialSteps={await getSteps(build.id)}
        initialIssues={getIssues(build)}
        startedAt={build.started_at}
        finishedAt={build.finished_at}
        upload={await uploadStepFor(build, submissions)}
      />

      <RunInsights kind='builds' runId={build.id} running={!isFinished(build.status)} cliVersion={build.cli_version} />
    </div>
  )
}

export default BuildPage
