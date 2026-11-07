// Next Imports
import { NextResponse, type NextRequest } from 'next/server'

// Lib Imports
import { getCurrentUser } from '@/lib/server/auth'
import { isCloud } from '@/lib/server/billing'
import { getOrgForUser } from '@/lib/server/orgs'
import { refreshFromStripe, stripeConfigured, syncCheckoutSession } from '@/lib/server/stripe'

export const dynamic = 'force-dynamic'

/**
 * Where Stripe Checkout and the Customer Portal send people back. The subscription is applied here, before any
 * page renders, so the sidebar, header and billing page all show the new plan on the first load (the billing
 * page alone would sync too late: the layout around it renders in parallel and keeps the old plan).
 */
export const GET = async (req: NextRequest) => {
  const url = req.nextUrl
  const slug = url.searchParams.get('org') ?? ''
  const sessionId = url.searchParams.get('session_id')
  const from = url.searchParams.get('from')
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303)

  const user = await getCurrentUser()

  if (!user) return to('/login')

  const org = slug ? await getOrgForUser(user.id, slug) : null

  if (!org) return to('/')

  if (isCloud() && stripeConfigured()) {
    try {
      if (sessionId) await syncCheckoutSession(sessionId, org.id)
      else await refreshFromStripe(org.id)
    } catch (e) {
      // The billing page retries and explains; details stay in the server log.
      console.error('[billing] return sync failed', e)
    }
  }

  const status = from === 'checkout' ? (sessionId ? '?checkout=success' : '?checkout=canceled') : ''

  return to(`/${org.slug}/billing${status}`)
}
