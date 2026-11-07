'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import PasswordInput from '@/views/auth/password-input'

// Action Imports
import { registerAction, type FormState } from '@/lib/actions/auth'

const RegisterForm = () => {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {})
  const err = state.fieldErrors ?? {}

  return (
    <form action={action} noValidate>
      <FieldGroup className='gap-4'>
        {state.error && (
          <Alert variant='destructive'>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Field className='gap-2' data-invalid={!!err.name}>
          <FieldLabel htmlFor='name'>Name</FieldLabel>
          <Input
            id='name'
            name='name'
            autoComplete='name'
            placeholder='Ada Lovelace'
            defaultValue={state.values?.name}
            aria-invalid={!!err.name}
          />
          {err.name && <FieldError>{err.name}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.email}>
          <FieldLabel htmlFor='email'>Email address</FieldLabel>
          <Input
            id='email'
            name='email'
            type='email'
            autoComplete='email'
            placeholder='you@company.com'
            defaultValue={state.values?.email}
            aria-invalid={!!err.email}
          />
          {err.email && <FieldError>{err.email}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.password}>
          <FieldLabel htmlFor='password'>Password</FieldLabel>
          <PasswordInput id='password' name='password' autoComplete='new-password' aria-invalid={!!err.password} />
          {err.password ? <FieldError>{err.password}</FieldError> : <FieldDescription>At least 8 characters.</FieldDescription>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.confirmPassword}>
          <FieldLabel htmlFor='confirmPassword'>Confirm password</FieldLabel>
          <PasswordInput
            id='confirmPassword'
            name='confirmPassword'
            autoComplete='new-password'
            aria-invalid={!!err.confirmPassword}
          />
          {err.confirmPassword && <FieldError>{err.confirmPassword}</FieldError>}
        </Field>
        <Field>
          <Button className='w-full' type='submit' disabled={pending}>
            {pending && <Loader2Icon className='animate-spin' />}
            Create account
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default RegisterForm
