// Next Imports
import { notFound } from 'next/navigation'

import { requireOrg } from './orgs'
import { getProjectBySlug } from './projects'

/** Page guard for /[org]/projects/[project]/...: member of the org and the project exists in it. */
export const requireProject = async (orgSlug: string, projectSlug: string) => {
  const { user, org } = await requireOrg(orgSlug)
  const project = await getProjectBySlug(org.id, decodeURIComponent(projectSlug))

  if (!project) notFound()

  return { user, org, project, base: `/${org.slug}/projects/${project.slug}` }
}

export type ProjectParams = Promise<{ org: string; project: string }>
export type OrgParams = Promise<{ org: string }>
