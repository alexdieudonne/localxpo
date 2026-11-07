'use client'

// React Imports
import { useActionState, useEffect } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// Third-party Imports
import { Loader2Icon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import FormMessage from '@/views/credentials/form-message'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { deleteOrgAction, updateOrgAction } from '@/lib/actions/orgs'

export const OrgSettingsForm = ({ orgSlug, name, disabled }: { orgSlug: string; name: string; disabled: boolean }) => {
  const router = useRouter()

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const id = toast.loading('Saving organization…')
    const res = await updateOrgAction(orgSlug, prev, formData)

    if (res.success) toast.success(res.success, { id })
    else toast.dismiss(id)

    return res
  }, {})

  const err = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo)
    if (state.success) router.refresh()
  }, [state, router])

  return (
    <form action={action}>
      <FieldGroup className='gap-4'>
        <FormMessage state={state} />
        <Field className='gap-2' data-invalid={!!err.name}>
          <FieldLabel htmlFor='name'>Name</FieldLabel>
          <Input id='name' name='name' defaultValue={name} disabled={disabled} />
          {err.name && <FieldError>{err.name}</FieldError>}
        </Field>
        <Field className='gap-2' data-invalid={!!err.slug}>
          <FieldLabel htmlFor='slug'>URL</FieldLabel>
          <div className='flex items-center gap-1'>
            <span className='text-muted-foreground text-sm'>/</span>
            <Input id='slug' name='slug' defaultValue={orgSlug} className='font-mono' disabled={disabled} />
          </div>
          {err.slug && <FieldError>{err.slug}</FieldError>}
        </Field>
        {!disabled && (
          <Button type='submit' disabled={pending} className='w-fit'>
            {pending && <Loader2Icon className='animate-spin' />}
            Save
          </Button>
        )}
      </FieldGroup>
    </form>
  )
}

export const DeleteOrgButton = ({ orgSlug, name, disabled }: { orgSlug: string; name: string; disabled: boolean }) => {
  const { run, pending } = useActionToast()

  return (
    <Button
      variant='destructive'
      disabled={disabled || pending}
      onClick={() => {
        if (prompt(`Type "${orgSlug}" to delete ${name} and everything in it.`) === orgSlug)
          run(() => deleteOrgAction(orgSlug), { loading: `Deleting ${name}…`, success: `${name} was deleted.` })
      }}
    >
      <Trash2Icon />
      Delete organization
    </Button>
  )
}
