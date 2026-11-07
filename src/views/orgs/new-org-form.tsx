'use client'

// React Imports
import { useActionState, useEffect, useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// Third-party Imports
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import FormMessage from '@/views/credentials/form-message'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { createOrgAction } from '@/lib/actions/orgs'

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const NewOrgForm = () => {
  const router = useRouter()

  // Wrap the action: "Creating…" toast while the server works, then go to the new organization.
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const id = toast.loading(`Creating ${String(formData.get('name') || 'organization')}…`)
    const res = await createOrgAction(prev, formData)

    if (res.redirectTo) toast.success(res.success ?? 'Organization created.', { id, description: 'It is now in the sidebar on the left.' })
    else toast.dismiss(id)

    return res
  }, {})

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo)
      router.refresh()
    }
  }, [state, router])

  const [name, setName] = useState(state.values?.name ?? '')
  const [slug, setSlug] = useState<string | null>(state.values?.slug ?? null)
  const err = state.fieldErrors ?? {}

  return (
    <form action={action} noValidate>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <Field className='gap-2' data-invalid={!!err.name}>
          <FieldLabel htmlFor='name'>Name</FieldLabel>
          <Input id='name' name='name' value={name} onChange={e => setName(e.target.value)} placeholder='Acme Mobile' autoFocus />
          {err.name && <FieldError>{err.name}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.slug}>
          <FieldLabel htmlFor='slug'>URL</FieldLabel>
          <div className='flex items-center gap-1'>
            <span className='text-muted-foreground text-sm'>/</span>
            <Input id='slug' name='slug' value={slug ?? toSlug(name)} onChange={e => setSlug(toSlug(e.target.value))} className='font-mono' />
          </div>
          {err.slug ? <FieldError>{err.slug}</FieldError> : <FieldDescription>Used in links and picked with `npx localxpo link`.</FieldDescription>}
        </Field>
        <Button type='submit' disabled={pending || !!state.redirectTo} className='w-fit'>
          {pending && <Loader2Icon className='animate-spin' />}
          {pending ? 'Creating…' : state.redirectTo ? 'Opening…' : 'Create organization'}
        </Button>
      </FieldGroup>
    </form>
  )
}

export default NewOrgForm
