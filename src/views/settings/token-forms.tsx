'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon, PlusIcon } from 'lucide-react'

// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import { createTokenAction, revokeTokenAction, type TokenState } from '@/lib/actions/tokens'

export const CreateTokenForm = ({ serverUrl }: { serverUrl: string }) => {
  const [state, action, pending] = useActionState<TokenState, FormData>(createTokenAction, {})

  return (
    <div className='space-y-4'>
      <form action={action} className='flex flex-wrap gap-2'>
        <Input name='name' placeholder='Token name, e.g. "Mac mini" or "CI"' className='max-w-xs' />
        <Button type='submit' disabled={pending}>
          {pending ? <Loader2Icon className='animate-spin' /> : <PlusIcon />}
          Create token
        </Button>
      </form>
      {state.error && <p className='text-destructive text-sm'>{state.error}</p>}
      {state.token && (
        <Alert className='border-emerald-500/30 bg-emerald-500/5'>
          <AlertTitle>Copy it now: it won’t be shown again</AlertTitle>
          <AlertDescription className='w-full space-y-2'>
            <CodeBlock code={state.token} />
            <p>Use it where you can’t type a password (CI, a headless Mac):</p>
            <CodeBlock code={`LOCALXPO_URL=${serverUrl} LOCALXPO_TOKEN=${state.token} npx localxpo build -p ios`} />
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export const RevokeTokenButton = ({ id }: { id: string }) => {
  const { run, pending } = useActionToast()

  return (
    <Button
      variant='ghost'
      size='sm'
      className='text-destructive'
      disabled={pending}
      onClick={() => {
        if (confirm('Revoke this token? Machines using it will need to log in again.')) run(() => revokeTokenAction(id), { loading: 'Revoking token…', success: 'Token revoked. Machines using it must sign in again.' })
      }}
    >
      Revoke
    </Button>
  )
}
