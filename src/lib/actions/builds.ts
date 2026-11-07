'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { deleteBuild, getBuild, updateBuild } from '@/lib/server/builds'
import { requireOrgAction } from '@/lib/server/orgs'

export const deleteBuildAction = async (orgSlug: string, buildId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const build = await getBuild(org.id, buildId)

    await deleteBuild(org.id, buildId)
    revalidatePath(`/${org.slug}`, 'layout')

    return {
      message: build ? `Build #${build.number} deleted.` : 'Build deleted.',
      redirectTo: build ? `/${org.slug}/projects/${build.project_slug}/builds` : `/${org.slug}`
    }
  })

/** For builds whose machine went away mid-build (laptop closed, CLI killed). */
export const markBuildCanceledAction = async (orgSlug: string, buildId: string): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)
    const build = await getBuild(org.id, buildId)

    if (build?.status === 'in_progress') await updateBuild(build, { status: 'canceled', errorMessage: 'Marked as canceled from the dashboard.' })

    revalidatePath(`/${org.slug}`, 'layout')
  })
