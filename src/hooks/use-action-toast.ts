'use client'

// React Imports
import { useTransition } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// Third-party Imports
import { toast } from 'sonner'

// Type Imports
import type { ActionResult } from '@/lib/action-result'

type Messages = { loading: string; success: string | ((r: ActionResult) => string) }

/**
 * Runs a server action with a loading → success / error toast, then follows `redirectTo` and refreshes
 * server components (sidebar lists, counts) so the UI reflects the change right away.
 */
export const useActionToast = () => {
  const router = useRouter()
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<ActionResult | void>, messages: Messages) =>
    start(async () => {
      const id = toast.loading(messages.loading)

      try {
        const res = (await fn()) ?? {}

        if (res.error) {
          toast.error(res.error, { id })

          return
        }

        toast.success(res.message ?? (typeof messages.success === 'function' ? messages.success(res) : messages.success), { id })

        // Off-site (Stripe Checkout / Portal): a full page navigation.
        if (res.redirectTo && /^https?:\/\//.test(res.redirectTo)) {
          window.location.assign(res.redirectTo)

          return
        }

        if (res.redirectTo) router.push(res.redirectTo)
        router.refresh()
      } catch {
        toast.error('Something went wrong. Please try again.', { id })
      }
    })

  return { run, pending }
}
