'use client'

// React Imports
import { useActionState, useEffect } from 'react'

// Third-party Imports
import { Loader2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import FormMessage from '@/views/credentials/form-message'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { deleteEnvVarAction, setEnvVarAction } from '@/lib/actions/env-vars'

const ENVS = ['development', 'preview', 'production'] as const

export const EnvVarForm = ({ orgSlug, projectId }: { orgSlug: string; projectId: string }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(setEnvVarAction.bind(null, orgSlug, projectId), {})
  const err = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.success) toast.success(state.success)
  }, [state])

  return (

    // Reset the inputs after each successful save.
    <form action={action} key={state.success} className='space-y-4'>
      <FormMessage state={{ success: state.success, error: state.error }} />
      <div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
        <Field className='gap-2' data-invalid={!!err.name}>
          <FieldLabel htmlFor='env-name'>Name</FieldLabel>
          <Input
            id='env-name'
            name='name'
            placeholder='EXPO_PUBLIC_API_URL'
            defaultValue={state.values?.name}
            className='font-mono uppercase'
            autoComplete='off'
          />
          {err.name && <FieldError>{err.name}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.value}>
          <FieldLabel htmlFor='env-value'>Value</FieldLabel>
          <Textarea id='env-value' name='value' rows={1} defaultValue={state.values?.value} className='min-h-9 font-mono text-sm' autoComplete='off' />
          {err.value && <FieldError>{err.value}</FieldError>}
        </Field>
      </div>
      <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
        <fieldset className='flex flex-wrap items-center gap-4'>
          <legend className='sr-only'>Environments</legend>
          {ENVS.map(e => (
            <label key={e} className='flex items-center gap-2 text-sm capitalize'>
              <Checkbox name={`env_${e}`} defaultChecked />
              {e}
            </label>
          ))}
        </fieldset>
        <label className='flex items-center gap-2 text-sm'>
          <Switch name='secret' />
          Secret (hidden after saving, redacted in logs)
        </label>
        <Button type='submit' disabled={pending} className='ml-auto'>
          {pending && <Loader2Icon className='animate-spin' />}
          Save variable
        </Button>
      </div>
      {err.environments && <p className='text-destructive text-sm'>{err.environments}</p>}
    </form>
  )
}

export const DeleteEnvVarButton = ({ orgSlug, projectId, id, label }: { orgSlug: string; projectId: string; id: string; label: string }) => {
  const { run, pending } = useActionToast()

  return (
    <Button
      variant='ghost'
      size='icon-xs'
      className='text-muted-foreground hover:text-destructive shrink-0'
      disabled={pending}
      title='Delete'
      onClick={() => {
        if (confirm(`Delete ${label}?`)) run(() => deleteEnvVarAction(orgSlug, projectId, id), { loading: `Deleting ${label}…`, success: `${label} deleted.` })
      }}
    >
      <XIcon />
      <span className='sr-only'>Delete {label}</span>
    </Button>
  )
}
