// Next Imports
import { notFound, redirect } from 'next/navigation'

// Lib Imports
import { requireUser } from '@/lib/server/auth'
import { buildPath, getBuildForUser } from '@/lib/server/builds'

/** Short, stable link printed by older CLIs: /builds/:id → canonical org/project URL. */
const LegacyBuildPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const build = await getBuildForUser(user.id, (await params).id)

  if (!build) notFound()
  redirect(buildPath(build))
}

export default LegacyBuildPage
