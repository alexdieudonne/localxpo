// Next Imports
import { redirect } from 'next/navigation'

// Lib Imports
import { requireOrg } from '@/lib/server/orgs'

/** /:org/projects → the organization's projects page (redirect built from the stored slug, never the raw URL). */
const ProjectsIndex = async ({ params }: { params: Promise<{ org: string }> }) => {
  const { org } = await requireOrg((await params).org)

  redirect(`/${org.slug}`)
}

export default ProjectsIndex
