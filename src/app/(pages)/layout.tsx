// React Imports
import type { ReactNode } from 'react'

// Next Imports
import { cookies } from 'next/headers'

// Component Imports
import AppSidebar, { ORG_COOKIE } from '@/components/layout/AppSidebar'
import Header from '@/components/layout/Header'
import { SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

// Lib Imports
import { requireUser } from '@/lib/server/auth'
import { getOrgPlan, isCloud } from '@/lib/server/billing'
import { failUnresponsiveRuns } from '@/lib/server/liveness'
import { listOrgsForUser } from '@/lib/server/orgs'
import { listProjectsForUser } from '@/lib/server/projects'

// The signed-in dashboard is private: never indexed, even if a URL leaks into a search engine.
export const metadata = { robots: { index: false, follow: false } }

const PagesLayout = async ({ children }: Readonly<{ children: ReactNode }>) => {
  const user = await requireUser()

  // Builds whose machine went silent are marked failed before any list or page shows them (throttled).
  await failUnresponsiveRuns().catch(e => console.error('[liveness]', e))
  const userOrgs = await listOrgsForUser(user.id)
  const cloud = isCloud()

  const orgs = await Promise.all(
    userOrgs.map(async o => {
      if (!cloud) return { slug: o.slug, name: o.name, role: o.role, plan: null }

      const { plan, billing } = await getOrgPlan(o.id)

      return { slug: o.slug, name: o.name, role: o.role, plan: plan.name, tier: plan.id, trial: billing.status === 'trialing' && plan.id !== 'free' }
    })
  )

  const orgSlugById = new Map(userOrgs.map(o => [o.id, o.slug]))

  const projects = (await listProjectsForUser(user.id)).map(p => ({
    orgSlug: orgSlugById.get(p.org_id)!,
    slug: p.slug,
    name: p.name,
    identifier: p.ios_bundle_id ?? p.android_package,
    lastStatus: p.last_status
  }))

  const remembered = (await cookies()).get(ORG_COOKIE)?.value
  const fallbackOrg = orgs.find(o => o.slug === remembered)?.slug ?? orgs[0]?.slug ?? null

  return (
    <div className='flex h-full w-full min-w-0'>
      <AppSidebar orgs={orgs} projects={projects} fallbackOrg={fallbackOrg} user={{ name: user.name, email: user.email }} cloud={cloud} />
      <SidebarInset className='flex min-w-0 flex-1 flex-col'>
        <Header user={{ name: user.name, email: user.email }} orgs={orgs} projects={projects} fallbackOrg={fallbackOrg} />
        <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>{children}</main>
        <Toaster />
      </SidebarInset>
    </div>
  )
}

export default PagesLayout
