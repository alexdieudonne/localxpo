'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import PasswordInput from '@/views/auth/password-input'
import FormMessage from '@/views/credentials/form-message'

// Action Imports
import { changePasswordAction, updateProfileAction, type FormState } from '@/lib/actions/auth'

export const ProfileForm = ({ name, email }: { name: string; email: string }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {})

  return (
    <form action={action}>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <Field className='gap-2' data-invalid={!!state.fieldErrors?.name}>
          <FieldLabel htmlFor='name'>Name</FieldLabel>
          <Input id='name' name='name' defaultValue={name} />
          {state.fieldErrors?.name && <FieldError>{state.fieldErrors.name}</FieldError>}
        </Field>
        <Field className='gap-2'>
          <FieldLabel htmlFor='email'>Email</FieldLabel>
          <Input id='email' value={email} disabled readOnly />
        </Field>
        <Button type='submit' disabled={pending} className='w-fit'>
          {pending && <Loader2Icon className='animate-spin' />}
          Save
        </Button>
      </FieldGroup>
    </form>
  )
}

export const PasswordForm = () => {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {})
  const err = state.fieldErrors ?? {}

  return (
    <form action={action} key={state.success}>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <Field className='gap-2' data-invalid={!!err.currentPassword}>
          <FieldLabel htmlFor='currentPassword'>Current password</FieldLabel>
          <PasswordInput id='currentPassword' name='currentPassword' autoComplete='current-password' />
          {err.currentPassword && <FieldError>{err.currentPassword}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.newPassword}>
          <FieldLabel htmlFor='newPassword'>New password</FieldLabel>
          <PasswordInput id='newPassword' name='newPassword' autoComplete='new-password' />
          {err.newPassword && <FieldError>{err.newPassword}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.confirmPassword}>
          <FieldLabel htmlFor='confirmPassword'>Confirm new password</FieldLabel>
          <PasswordInput id='confirmPassword' name='confirmPassword' autoComplete='new-password' />
          {err.confirmPassword && <FieldError>{err.confirmPassword}</FieldError>}
        </Field>
        <Button type='submit' disabled={pending} className='w-fit'>
          {pending && <Loader2Icon className='animate-spin' />}
          Change password
        </Button>
      </FieldGroup>
    </form>
  )
}
