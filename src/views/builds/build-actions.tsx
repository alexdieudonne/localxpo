'use client'

// Third-party Imports
import { BanIcon, EllipsisVerticalIcon, Trash2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import { deleteBuildAction, markBuildCanceledAction } from '@/lib/actions/builds'

const BuildActions = ({ orgSlug, buildId, running }: { orgSlug: string; buildId: string; running: boolean }) => {
  const { run, pending } = useActionToast()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant='outline' size='icon' disabled={pending} />}>
        <EllipsisVerticalIcon />
        <span className='sr-only'>Build actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        {running && (
          <DropdownMenuItem
            onClick={() => run(() => markBuildCanceledAction(orgSlug, buildId), { loading: 'Canceling build…', success: 'Build marked as canceled.' })}
          >
            <BanIcon />
            Mark as canceled (without stopping)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant='destructive'
          onClick={() => {
            if (confirm('Delete this build and its logs? This cannot be undone.'))
              run(() => deleteBuildAction(orgSlug, buildId), { loading: 'Deleting build…', success: 'Build deleted.' })
          }}
        >
          <Trash2Icon />
          Delete build
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default BuildActions
