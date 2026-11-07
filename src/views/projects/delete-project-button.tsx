'use client'

// Third-party Imports
import { Loader2Icon, Trash2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import { deleteProjectAction } from '@/lib/actions/projects'

const DeleteProjectButton = ({ orgSlug, projectId, name }: { orgSlug: string; projectId: string; name: string }) => {
  const { run, pending } = useActionToast()

  return (
    <Button
      variant='destructive'
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete ${name}, all its builds, logs and its Android keystore backup? This cannot be undone.`))
          run(() => deleteProjectAction(orgSlug, projectId), { loading: `Deleting ${name}…`, success: `${name} was deleted.` })
      }}
    >
      {pending ? <Loader2Icon className='animate-spin' /> : <Trash2Icon />}
      Delete project
    </Button>
  )
}

export default DeleteProjectButton
