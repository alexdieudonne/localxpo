'use client'

// React Imports
import { useActionState, useEffect } from 'react'

// Third-party Imports
import { EllipsisIcon, Loader2Icon, LogOutIcon, ShieldIcon, UserMinusIcon, UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import FormMessage from '@/views/credentials/form-message'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Action Imports
import type { FormState } from '@/lib/actions/auth'
import { addMemberAction, removeMemberAction, setMemberRoleAction } from '@/lib/actions/orgs'

export const AddMemberForm = ({ orgSlug }: { orgSlug: string }) => {
  const [state, action, pending] = useActionState<FormState, FormData>(addMemberAction.bind(null, orgSlug), {})

  useEffect(() => {
    if (state.success) toast.success(state.success)
  }, [state])

  return (
    <form action={action} className='space-y-3' key={state.success}>
      <FormMessage state={{ success: state.success, error: state.error }} />
      <div className='flex flex-wrap items-start gap-2'>
        <Field className='max-w-sm flex-1 gap-1.5' data-invalid={!!state.fieldErrors?.email}>
          <Input name='email' type='email' placeholder='teammate@company.com' defaultValue={state.values?.email} aria-label='Email' />
          {state.fieldErrors?.email && <FieldError>{state.fieldErrors.email}</FieldError>}
        </Field>
        <select
          name='role'
          className='border-input bg-background h-9 rounded-md border px-2 text-sm'
          defaultValue='member'
          aria-label='Role'
        >
          <option value='member'>Member</option>
          <option value='owner'>Owner</option>
        </select>
        <Button type='submit' disabled={pending}>
          {pending ? <Loader2Icon className='animate-spin' /> : <UserPlusIcon />}
          Add
        </Button>
      </div>
    </form>
  )
}

export const MemberActions = ({
  orgSlug,
  member,
  isSelf,
  canManage
}: {
  orgSlug: string
  member: { userId: string; name: string; role: string }
  isSelf: boolean
  canManage: boolean
}) => {
  const { run, pending } = useActionToast()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant='ghost' size='icon-sm' disabled={pending} />}>
        <EllipsisIcon />
        <span className='sr-only'>Member actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-52'>
        {canManage && (
          <DropdownMenuItem onClick={() =>
              run(() => setMemberRoleAction(orgSlug, member.userId, member.role === 'owner' ? 'member' : 'owner'), {
                loading: 'Updating role…',
                success: `${member.name} is now ${member.role === 'owner' ? 'a member' : 'an owner'}.`
              })
            }>
            <ShieldIcon />
            {member.role === 'owner' ? 'Make member' : 'Make owner'}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant='destructive'
          onClick={() => {
            if (confirm(isSelf ? 'Leave this organization?' : `Remove ${member.name} from this organization?`))
              run(() => removeMemberAction(orgSlug, member.userId), {
                loading: isSelf ? 'Leaving organization…' : `Removing ${member.name}…`,
                success: isSelf ? 'You left the organization.' : `${member.name} was removed.`
              })
          }}
        >
          {isSelf ? <LogOutIcon /> : <UserMinusIcon />}
          {isSelf ? 'Leave organization' : 'Remove'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
