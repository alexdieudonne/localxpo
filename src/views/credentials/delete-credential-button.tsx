'use client'

// Third-party Imports
import { Trash2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import { deleteCredentialAction } from '@/lib/actions/credentials'

const DeleteCredentialButton = ({ orgSlug, id, warning }: { orgSlug: string; id: string; warning: string }) => {
  const { run, pending } = useActionToast()

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      className='text-muted-foreground hover:text-destructive'
      disabled={pending}
      onClick={() => {
        if (confirm(warning)) run(() => deleteCredentialAction(orgSlug, id), { loading: 'Deleting credential…', success: 'Credential deleted.' })
      }}
      title='Delete'
    >
      <Trash2Icon />
      <span className='sr-only'>Delete</span>
    </Button>
  )
}

export default DeleteCredentialButton
