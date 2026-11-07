'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import FormMessage from '@/views/credentials/form-message'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { saveGoogleServiceAccountAction } from '@/lib/actions/credentials'

const GoogleServiceAccountForm = ({ orgSlug, hasExisting }: { orgSlug: string; hasExisting: boolean }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(saveGoogleServiceAccountAction.bind(null, orgSlug), {})

  return (
    <form action={action} noValidate>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <Field className='gap-2' data-invalid={!!state.fieldErrors?.json}>
          <FieldLabel htmlFor='json'>Service account key (.json)</FieldLabel>
          <Input id='json' name='json' type='file' accept='.json,application/json' />
          {state.fieldErrors?.json ? (
            <FieldError>{state.fieldErrors.json}</FieldError>
          ) : (
            <FieldDescription>Stored encrypted. Used by the CLI to upload to your Play tracks.</FieldDescription>
          )}
        </Field>
        <Field>
          <Button type='submit' disabled={pending} className='w-fit'>
            {pending && <Loader2Icon className='animate-spin' />}
            {hasExisting ? 'Replace key' : 'Save and verify'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default GoogleServiceAccountForm
