'use client'

// React Imports
import { useActionState } from 'react'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import PasswordInput from '@/views/auth/password-input'

// Action Imports
import { loginAction, type FormState } from '@/lib/actions/auth'

const LoginForm = ({ next }: { next?: string }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {})

  return (
    <form action={action} noValidate>
      <input type='hidden' name='next' value={next ?? '/'} />
      <FieldGroup className='gap-4'>
        {state.error && (
          <Alert variant='destructive'>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <Field className='gap-2' data-invalid={!!state.fieldErrors?.email}>
          <FieldLabel htmlFor='email'>Email address</FieldLabel>
          <Input
            id='email'
            name='email'
            type='email'
            autoComplete='email'
            placeholder='you@company.com'
            defaultValue={state.values?.email}
            aria-invalid={!!state.fieldErrors?.email}
            required
          />
          {state.fieldErrors?.email && <FieldError>{state.fieldErrors.email}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!state.fieldErrors?.password}>
          <FieldLabel htmlFor='password'>Password</FieldLabel>
          <PasswordInput id='password' name='password' autoComplete='current-password' required />
          {state.fieldErrors?.password && <FieldError>{state.fieldErrors.password}</FieldError>}
        </Field>
        <Field>
          <Button className='w-full' type='submit' disabled={pending}>
            {pending && <Loader2Icon className='animate-spin' />}
            Sign in
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}

export default LoginForm
