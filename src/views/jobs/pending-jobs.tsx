'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Third-party Imports
import { AlertTriangleIcon, ClockIcon, HourglassIcon, Loader2Icon, XIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { cancelJobAction } from '@/lib/actions/jobs'

export type PendingJob = {
  id: string
  kind: 'build' | 'submit'
  machine: string
  status: string
  label: string
  error: string | null
  created_at: number
  agentOnline: boolean
  afterBuild: { id: string; number: number } | null
}

/** Jobs waiting for a machine. Refreshes every 3 s so a build shows up in the list as soon as it starts. */
const PendingJobs = ({ orgSlug, jobs, base }: { orgSlug: string; jobs: PendingJob[]; base: string }) => {
  const router = useRouter()
  const { run, pending } = useActionToast()
  const waiting = jobs.some(j => j.status === 'queued' || j.status === 'claimed' || j.status === 'waiting')

  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => router.refresh(), 3000)

    return () => clearInterval(t)
  }, [waiting, router])

  if (!jobs.length) return null

  return (
    <div className='space-y-2'>
      {jobs.map(j => (
        <div key={j.id} className='flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm'>
          <span className='flex min-w-0 items-center gap-2.5'>
            {j.status === 'failed' || j.status === 'canceled' ? (
              <AlertTriangleIcon className='size-4 shrink-0 text-amber-600 dark:text-amber-400' aria-label='not started' />
            ) : j.status === 'waiting' ? (
              <HourglassIcon className='text-muted-foreground size-4 shrink-0' aria-label='waiting' />
            ) : j.status === 'claimed' ? (
              <Loader2Icon className='size-4 shrink-0 animate-spin text-sky-600' aria-label='starting' />
            ) : (
              <ClockIcon className='text-muted-foreground size-4 shrink-0' aria-label='queued' />
            )}
            <span className='min-w-0'>
              <span className='font-medium'>{j.label}</span>
              <span className='text-muted-foreground block truncate text-xs'>
                {j.status === 'canceled' ? (
                  j.error
                ) : j.status === 'failed' ? (
                  `Could not start on ${j.machine}: ${j.error ?? 'unknown error'}`
                ) : j.status === 'waiting' ? (
                  j.afterBuild ? (
                    <>
                      Starts on {j.machine} when{' '}
                      <Link href={`${base}/builds/${j.afterBuild.id}`} className='text-foreground underline-offset-2 hover:underline'>
                        build #{j.afterBuild.number}
                      </Link>{' '}
                      succeeds
                    </>
                  ) : (
                    `Starts on ${j.machine} once its build has succeeded`
                  )
                ) : j.status === 'claimed' ? (
                  `Starting on ${j.machine}…`
                ) : j.agentOnline ? (
                  `Queued on ${j.machine}`
                ) : (
                  `Waiting for ${j.machine}: start \`npx localxpo agent\` there`
                )}
              </span>
            </span>
          </span>
          <Button
            size='sm'
            variant='ghost'
            disabled={pending}
            onClick={() => run(() => cancelJobAction(orgSlug, j.id), { loading: 'Removing…', success: 'Removed.' })}
          >
            <XIcon /> {j.status === 'failed' || j.status === 'canceled' ? 'Dismiss' : 'Cancel'}
          </Button>
        </div>
      ))}
    </div>
  )
}

export default PendingJobs
