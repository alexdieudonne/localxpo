'use client'

// Third-party Imports
import { ExternalLinkIcon, Loader2Icon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { openPortalAction } from '@/lib/actions/billing'

/** Payment method, invoices and cancellation, in Stripe's hosted portal. */
const PortalButton = ({ orgSlug, label = 'Manage billing', variant = 'outline' }: { orgSlug: string; label?: string; variant?: 'outline' | 'default' }) => {
  const { run, pending } = useActionToast()

  return (
    <Button variant={variant} disabled={pending} onClick={() => run(() => openPortalAction(orgSlug), { loading: 'Opening the billing portal…', success: 'Redirecting…' })}>
      {pending ? <Loader2Icon className='animate-spin' /> : <ExternalLinkIcon />} {label}
    </Button>
  )
}

export default PortalButton
