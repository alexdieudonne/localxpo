'use client'

// Third-party Imports
import { CloudUploadIcon, Loader2Icon, RotateCcwIcon, SquareIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { cancelBuildAction, cancelSubmissionAction, rebuildAction, retrySubmissionAction, submitBuildAction } from '@/lib/actions/jobs'

/** Cancel / Rebuild / Submit to store, on the build page. */
export const BuildControls = ({
  orgSlug,
  buildId,
  running,
  stopping,
  canSubmit,
  platform,
  agentOnline
}: {
  orgSlug: string
  buildId: string
  running: boolean
  stopping: boolean
  canSubmit: boolean
  platform: 'ios' | 'android'
  agentOnline: boolean
}) => {
  const { run, pending } = useActionToast()
  const agentHint = agentOnline ? undefined : 'The agent on this machine is offline: it will start when `npx localxpo agent` runs there.'

  return (
    <>
      {running ? (
        <Button
          variant='destructive'
          disabled={pending || stopping}
          onClick={() => run(() => cancelBuildAction(orgSlug, buildId), { loading: 'Canceling…', success: 'Cancel requested.' })}
        >
          {stopping ? <Loader2Icon className='animate-spin' /> : <SquareIcon />}
          {stopping ? 'Stopping…' : 'Cancel build'}
        </Button>
      ) : (
        <>
          {canSubmit && (
            <Button
              disabled={pending}
              title={agentHint}
              onClick={() => run(() => submitBuildAction(orgSlug, buildId), { loading: 'Queuing upload…', success: 'Upload queued.' })}
            >
              <CloudUploadIcon /> Submit to {platform === 'ios' ? 'TestFlight' : 'Google Play'}
            </Button>
          )}
          <Button
            variant='outline'
            disabled={pending}
            title={agentHint}
            onClick={() => run(() => rebuildAction(orgSlug, buildId), { loading: 'Queuing build…', success: 'Build queued.' })}
          >
            <RotateCcwIcon /> Rebuild
          </Button>
        </>
      )}
    </>
  )
}

/** Cancel / Retry, on the submission page. */
export const SubmissionControls = ({
  orgSlug,
  submissionId,
  running,
  stopping,
  canRetry
}: {
  orgSlug: string
  submissionId: string
  running: boolean
  stopping: boolean
  canRetry: boolean
}) => {
  const { run, pending } = useActionToast()

  if (running)
    return (
      <Button
        variant='destructive'
        disabled={pending || stopping}
        onClick={() => run(() => cancelSubmissionAction(orgSlug, submissionId), { loading: 'Canceling…', success: 'Cancel requested.' })}
      >
        {stopping ? <Loader2Icon className='animate-spin' /> : <SquareIcon />}
        {stopping ? 'Stopping…' : 'Cancel upload'}
      </Button>
    )

  return canRetry ? (
    <Button variant='outline' disabled={pending} onClick={() => run(() => retrySubmissionAction(orgSlug, submissionId), { loading: 'Queuing upload…', success: 'Upload queued.' })}>
      <RotateCcwIcon /> Retry upload
    </Button>
  ) : null
}
