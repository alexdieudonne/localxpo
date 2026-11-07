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
import { saveAppleKeyAction } from '@/lib/actions/credentials'

const AppleKeyForm = ({ orgSlug, hasExisting }: { orgSlug: string; hasExisting: boolean }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAppleKeyAction.bind(null, orgSlug), {})
  const err = state.fieldErrors ?? {}

  return (
    <form action={action} noValidate>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field className='gap-2' data-invalid={!!err.keyId}>
            <FieldLabel htmlFor='keyId'>Key ID</FieldLabel>
            <Input id='keyId' name='keyId' placeholder='2X9R4HXF34' className='font-mono uppercase' autoComplete='off' />
            {err.keyId && <FieldError>{err.keyId}</FieldError>}
          </Field>
          <Field className='gap-2' data-invalid={!!err.teamId}>
            <FieldLabel htmlFor='teamId'>Team ID</FieldLabel>
            <Input id='teamId' name='teamId' placeholder='A1B2C3D4E5' className='font-mono uppercase' autoComplete='off' />
            {err.teamId && <FieldError>{err.teamId}</FieldError>}
          </Field>
        </div>
        <Field className='gap-2' data-invalid={!!err.issuerId}>
          <FieldLabel htmlFor='issuerId'>Issuer ID</FieldLabel>
          <Input id='issuerId' name='issuerId' placeholder='57246542-96fe-1a63-e053-0824d011072a' className='font-mono' autoComplete='off' />
          {err.issuerId && <FieldError>{err.issuerId}</FieldError>}
        </Field>
        <Field className='gap-2'>
          <FieldLabel htmlFor='teamName'>Team name (optional)</FieldLabel>
          <Input id='teamName' name='teamName' placeholder='Acme Inc.' />
        </Field>
        <Field className='gap-2' data-invalid={!!err.p8}>
          <FieldLabel htmlFor='p8'>Private key (.p8)</FieldLabel>
          <Input id='p8' name='p8' type='file' accept='.p8,text/plain' />
          {err.p8 ? (
            <FieldError>{err.p8}</FieldError>
          ) : (
            <FieldDescription>Apple only lets you download it once. Stored encrypted; only your CLI can read it back.</FieldDescription>
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

export default AppleKeyForm
