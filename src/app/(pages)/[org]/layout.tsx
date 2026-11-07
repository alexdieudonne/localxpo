// React Imports
import type { ReactNode } from 'react'

// Component Imports
import BillingBanner from '@/views/billing/billing-banner'

// Lib Imports
import { pruneHistory } from '@/lib/server/billing'
import { requireOrg } from '@/lib/server/orgs'

/** Every page under /[org] requires membership (404 otherwise). */
const OrgLayout = async ({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) => {
  const { org } = await requireOrg((await params).org)

  // localxpo Cloud: drop history older than the plan keeps (throttled to once an hour per organization).
  await pruneHistory(org.id).catch(e => console.error('[billing] prune failed', e))

  return (
    <>
      <BillingBanner org={org} />
      {children}
    </>
  )
}

export default OrgLayout
