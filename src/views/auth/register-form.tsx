'use client'

// React Imports
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from 'react'

// Third-party Imports
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon } from 'lucide-react'

// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import PasswordInput from '@/views/auth/password-input'

// Action Imports
import { registerAction, type FormState } from '@/lib/actions/auth'

// Lib Imports
import { COMPANY_SIZES, REFERRAL_SOURCES, USE_CASES, type Choice } from '@/lib/signup'
import { cn } from '@/lib/utils'

type Values = {
  name: string
  email: string
  password: string
  confirmPassword: string
  company: string
  companySize: string
  referralSource: string
  useCase: string
  useCaseDetails: string
}

type Errors = Partial<Record<keyof Values, string>>

const EMPTY: Values = { name: '', email: '', password: '', confirmPassword: '', company: '', companySize: '', referralSource: '', useCase: '', useCaseDetails: '' }

const STEPS = [
  { title: 'Your account', fields: ['name', 'email', 'password', 'confirmPassword'] },
  { title: 'Your company', fields: ['company', 'companySize'] },
  { title: 'Your plans', fields: ['useCase'] },
  { title: 'One last thing', fields: ['referralSource', 'useCaseDetails'] }
] as const satisfies readonly { title: string; fields: readonly (keyof Values)[] }[]

/** Same rules as the server action, so most mistakes are caught before leaving a step. */
const validateStep = (step: number, v: Values): Errors => {
  const e: Errors = {}

  if (step === 0) {
    if (!v.name.trim()) e.name = 'Enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Enter a valid email'
    if (v.password.length < 8) e.password = 'At least 8 characters'
    else if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords do not match'
  }

  if (step === 1) {
    if (!v.companySize) e.companySize = 'Pick a team size'
    if (!v.company.trim()) e.company = v.companySize === 'solo' ? 'Enter your studio or project name' : 'Enter your company name'
  }

  if (step === 2 && !v.useCase) e.useCase = 'Pick what you plan to do'
  if (step === 3 && !v.referralSource) e.referralSource = 'Tell us how you found localxpo'

  return e
}

// ---------- Choice chips ----------

const Chips = ({
  label,
  choices,
  value,
  onChange,
  invalid,
  columns = 'grid-cols-2'
}: {
  label: string
  choices: readonly Choice[]
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  columns?: string
}) => (
  <div role='radiogroup' aria-label={label} aria-invalid={invalid} className={cn('grid gap-2', columns)}>
    {choices.map((c, i) => {
      const checked = value === c.value

      return (
        <button
          key={c.value}
          type='button'
          role='radio'
          aria-checked={checked}
          onClick={() => onChange(c.value)}
          style={{ animationDelay: `${60 + i * 35}ms` }}
          className={cn(
            'animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm duration-300',
            'transition-[border-color,background-color,transform] outline-none active:scale-[0.98] motion-reduce:animate-none',
            'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            checked ? 'border-primary bg-primary/5 text-foreground' : 'border-input hover:border-foreground/30 hover:bg-muted/50',
            invalid && !checked && 'border-destructive/50'
          )}
        >
          <span
            className={cn(
              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition',
              checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
            )}
            aria-hidden
          >
            {checked && <CheckIcon className='animate-in zoom-in-50 size-3 duration-200' strokeWidth={3} />}
          </span>
          <span className='min-w-0'>
            <span className='block leading-5 font-medium'>{c.label}</span>
            {c.hint && <span className='text-muted-foreground block text-xs leading-4'>{c.hint}</span>}
          </span>
        </button>
      )
    })}
  </div>
)

// ---------- Progress ----------

const Progress = ({ step, total }: { step: number; total: number }) => (
  <div className='space-y-2'>
    <div className='flex items-center justify-between text-xs'>
      <span key={step} className='text-foreground animate-in fade-in slide-in-from-bottom-1 font-medium duration-300'>
        {STEPS[step].title}
      </span>
      <span className='text-muted-foreground tabular-nums'>
        Step {step + 1} of {total}
      </span>
    </div>
    <div className='flex gap-1.5' aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className='bg-muted h-1 flex-1 overflow-hidden rounded-full'>
          <span className={cn('bg-primary block h-full rounded-full transition-all duration-500', i <= step ? 'w-full' : 'w-0')} />
        </span>
      ))}
    </div>
  </div>
)

// ---------- Form ----------

/** Cloud sign-up asks four short steps (account, company, plans, how they found us); a self-hosted server only needs the account. */
const RegisterForm = ({ cloud = false }: { cloud?: boolean }) => {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(registerAction, {})
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [handled, setHandled] = useState<FormState>(state)

  const total = cloud ? STEPS.length : 1
  const last = step === total - 1

  // Server answer: show its errors and go back to the first step that has one.
  if (state !== handled) {
    setHandled(state)
    const fieldErrors = (state.fieldErrors ?? {}) as Errors

    setErrors(fieldErrors)
    const first = STEPS.findIndex(s => s.fields.some(f => fieldErrors[f]))

    if (first !== -1 && first < total && first !== step) {
      setDirection('back')
      setStep(first)
    }
  }

  const set = (key: keyof Values) => (value: string) => {
    setValues(v => ({ ...v, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
  }

  const go = (to: number) => {
    setDirection(to > step ? 'forward' : 'back')
    setStep(to)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return

    const stepErrors = validateStep(step, values)

    if (Object.keys(stepErrors).length > 0) return setErrors(stepErrors)
    if (!last) return go(step + 1)

    const data = new FormData()

    for (const [k, v] of Object.entries(values)) data.set(k, v)
    startTransition(() => dispatch(data))
  }

  const err = errors

  const field = (key: keyof Values, label: string, input: ReactNode, hint?: ReactNode) => (
    <Field className='gap-2' data-invalid={!!err[key]}>
      <FieldLabel htmlFor={key}>{label}</FieldLabel>
      {input}
      {err[key] ? <FieldError>{err[key]}</FieldError> : hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate className='space-y-5'>
      {cloud && <Progress step={step} total={total} />}

      {state.error && (
        <Alert variant='destructive'>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div
        key={step}
        className={cn('animate-in fade-in duration-300', direction === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4')}
      >
        {step === 0 && (
          <FieldGroup className='gap-4'>
            {field(
              'name',
              'Name',
              <Input id='name' autoComplete='name' placeholder='Ada Lovelace' value={values.name} onChange={e => set('name')(e.target.value)} aria-invalid={!!err.name} autoFocus />
            )}
            {field(
              'email',
              'Email address',
              <Input
                id='email'
                type='email'
                autoComplete='email'
                placeholder='you@company.com'
                value={values.email}
                onChange={e => set('email')(e.target.value)}
                aria-invalid={!!err.email}
              />
            )}
            {field(
              'password',
              'Password',
              <PasswordInput id='password' autoComplete='new-password' value={values.password} onChange={e => set('password')(e.target.value)} aria-invalid={!!err.password} />,
              'At least 8 characters.'
            )}
            {field(
              'confirmPassword',
              'Confirm password',
              <PasswordInput
                id='confirmPassword'
                autoComplete='new-password'
                value={values.confirmPassword}
                onChange={e => set('confirmPassword')(e.target.value)}
                aria-invalid={!!err.confirmPassword}
              />
            )}
          </FieldGroup>
        )}

        {step === 1 && (
          <FieldGroup className='gap-5'>
            <Field className='gap-2' data-invalid={!!err.companySize}>
              <FieldLabel>How big is your team?</FieldLabel>
              <Chips label='Team size' choices={COMPANY_SIZES} value={values.companySize} onChange={set('companySize')} invalid={!!err.companySize} columns='grid-cols-2 sm:grid-cols-3' />
              {err.companySize && <FieldError>{err.companySize}</FieldError>}
            </Field>
            {field(
              'company',
              values.companySize === 'solo' ? 'Studio or project name' : 'Company name',
              <Input
                id='company'
                autoComplete='organization'
                placeholder={values.companySize === 'solo' ? 'Your studio or app name' : 'Acme Inc.'}
                value={values.company}
                onChange={e => set('company')(e.target.value)}
                aria-invalid={!!err.company}
              />,
              'This becomes the name of your organization. You can rename it later.'
            )}
          </FieldGroup>
        )}

        {step === 2 && (
          <FieldGroup className='gap-5'>
            <Field className='gap-2' data-invalid={!!err.useCase}>
              <FieldLabel>What do you plan to do with localxpo?</FieldLabel>
              <Chips label='Use case' choices={USE_CASES} value={values.useCase} onChange={set('useCase')} invalid={!!err.useCase} columns='grid-cols-1 sm:grid-cols-2' />
              {err.useCase && <FieldError>{err.useCase}</FieldError>}
            </Field>
          </FieldGroup>
        )}

        {step === 3 && (
          <FieldGroup className='gap-5'>
            <Field className='gap-2' data-invalid={!!err.referralSource}>
              <FieldLabel>How did you hear about localxpo?</FieldLabel>
              <Chips label='How you found localxpo' choices={REFERRAL_SOURCES} value={values.referralSource} onChange={set('referralSource')} invalid={!!err.referralSource} />
              {err.referralSource && <FieldError>{err.referralSource}</FieldError>}
            </Field>
            {field(
              'useCaseDetails',
              'Anything else we should know? (optional)',
              <Textarea
                id='useCaseDetails'
                rows={2}
                maxLength={500}
                placeholder='The apps you ship, your current build setup…'
                value={values.useCaseDetails}
                onChange={e => set('useCaseDetails')(e.target.value)}
                aria-invalid={!!err.useCaseDetails}
              />
            )}
          </FieldGroup>
        )}
      </div>

      <div className='flex gap-2'>
        {step > 0 && (
          <Button type='button' variant='outline' onClick={() => go(step - 1)} disabled={pending}>
            <ArrowLeftIcon /> Back
          </Button>
        )}
        <Button className='flex-1' type='submit' disabled={pending}>
          {pending && <Loader2Icon className='animate-spin' />}
          {last ? 'Create account' : 'Continue'}
          {!last && <ArrowRightIcon />}
        </Button>
      </div>
    </form>
  )
}

export default RegisterForm
