'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { renameProjectAction } from '@/lib/actions/projects'

const RenameProjectForm = ({ orgSlug, projectId, name }: { orgSlug: string; projectId: string; name: string }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(renameProjectAction.bind(null, orgSlug, projectId), {})

  return (
    <form action={action} className='flex flex-wrap items-end gap-2'>
      <Field className='max-w-sm flex-1 gap-2' data-invalid={!!state.fieldErrors?.name}>
        <FieldLabel htmlFor='project-name'>Display name</FieldLabel>
        <Input id='project-name' name='name' defaultValue={name} />
        {state.fieldErrors?.name && <FieldError>{state.fieldErrors.name}</FieldError>}
      </Field>
      <Button type='submit' variant='outline' disabled={pending}>
        {pending && <Loader2Icon className='animate-spin' />}
        Save
      </Button>
      {state.success && <span className='text-sm text-emerald-600 dark:text-emerald-400'>{state.success}</span>}
    </form>
  )
}

export default RenameProjectForm
