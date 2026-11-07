// Next Imports
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Component Imports
import { ORG_COOKIE } from '@/components/layout/AppSidebar'

// Lib Imports
import { requireUser } from '@/lib/server/auth'
import { createOrg, listOrgsForUser, uniqueOrgSlug } from '@/lib/server/orgs'

export const dynamic = 'force-dynamic'

/** "/" opens the last organization you visited (or your first one). */
const HomePage = async () => {
  const user = await requireUser()
  let orgs = await listOrgsForUser(user.id)

  // Someone removed from every org still needs a home.
  if (orgs.length === 0) {
    await createOrg(user.name, user.id, await uniqueOrgSlug(user.email.split('@')[0]))
    orgs = await listOrgsForUser(user.id)
  }

  const remembered = (await cookies()).get(ORG_COOKIE)?.value

  redirect(`/${orgs.find(o => o.slug === remembered)?.slug ?? orgs[0].slug}`)
}

export default HomePage
