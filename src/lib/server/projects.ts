import { newId } from './crypto'
import { db } from './db'

export type Project = {
  id: string
  org_id: string
  created_by: string
  name: string
  slug: string
  ios_bundle_id: string | null
  android_package: string | null
  app_version: string | null
  sdk_version: string | null
  config_json: string | null
  eas_json: string | null
  created_at: number
  updated_at: number
}

export type ProjectWithStats = Project & {
  build_count: number
  last_build_at: number | null
  last_status: string | null
}

export type ProjectInput = {
  name: string
  slug: string
  iosBundleId?: string | null
  androidPackage?: string | null
  appVersion?: string | null
  sdkVersion?: string | null
  config?: unknown
  eas?: unknown
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-_.]{0,63}$/i

export const listProjects = async (orgId: string) =>
  ((await db.all(`SELECT p.*,
        (SELECT COUNT(*) FROM builds b WHERE b.project_id = p.id) AS build_count,
        (SELECT MAX(created_at) FROM builds b WHERE b.project_id = p.id) AS last_build_at,
        (SELECT status FROM builds b WHERE b.project_id = p.id ORDER BY created_at DESC LIMIT 1) AS last_status
       FROM projects p WHERE p.org_id = ? ORDER BY COALESCE((SELECT MAX(created_at) FROM builds b WHERE b.project_id = p.id), p.updated_at) DESC`, orgId)) as ProjectWithStats[])

/** Projects of every org the user belongs to (sidebar switchers). */
export const listProjectsForUser = async (userId: string) =>
  ((await db.all(`SELECT p.id, p.org_id, p.name, p.slug, p.ios_bundle_id, p.android_package,
        (SELECT status FROM builds b WHERE b.project_id = p.id ORDER BY created_at DESC LIMIT 1) AS last_status
       FROM projects p
       JOIN memberships m ON m.org_id = p.org_id AND m.user_id = ? ORDER BY lower(p.name)`, userId)) as (Pick<Project, 'id' | 'org_id' | 'name' | 'slug' | 'ios_bundle_id' | 'android_package'> & {
    last_status: string | null
  })[])

export const getProject = async (orgId: string, id: string) =>
  ((await db.one('SELECT * FROM projects WHERE id = ? AND org_id = ?', id, orgId)) as Project | undefined)

export const getProjectBySlug = async (orgId: string, slug: string) =>
  ((await db.one('SELECT * FROM projects WHERE slug = ? AND org_id = ?', slug, orgId)) as Project | undefined)

/** Project by id if the user belongs to its org (API routes). */
export const getProjectForUser = async (userId: string, id: string) =>
  ((await db.one('SELECT p.* FROM projects p JOIN memberships m ON m.org_id = p.org_id AND m.user_id = ? WHERE p.id = ?', userId, id)) as Project | undefined)

/** Create or update by slug: the CLI calls this before every build with the evaluated Expo config. */
export const upsertProject = async (orgId: string, userId: string, input: ProjectInput): Promise<Project> => {
  const now = Date.now()

  const existing = await getProjectBySlug(orgId, input.slug)

  const config = input.config === undefined ? null : JSON.stringify(input.config)
  const eas = input.eas === undefined ? null : JSON.stringify(input.eas)

  if (existing) {
    await db.run(`UPDATE projects SET
        ios_bundle_id = COALESCE(?, ios_bundle_id), android_package = COALESCE(?, android_package),
        app_version = COALESCE(?, app_version), sdk_version = COALESCE(?, sdk_version),
        config_json = COALESCE(?, config_json), eas_json = COALESCE(?, eas_json), updated_at = ?
       WHERE id = ?`, input.iosBundleId ?? null,
      input.androidPackage ?? null,
      input.appVersion ?? null,
      input.sdkVersion ?? null,
      config,
      eas,
      now,
      existing.id)

    return (await getProject(orgId, existing.id))!
  }

  const id = newId()

  await db.run(`INSERT INTO projects (id, org_id, created_by, name, slug, ios_bundle_id, android_package, app_version, sdk_version,
      config_json, eas_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
    orgId,
    userId,
    input.name,
    input.slug,
    input.iosBundleId ?? null,
    input.androidPackage ?? null,
    input.appVersion ?? null,
    input.sdkVersion ?? null,
    config,
    eas,
    now,
    now)

  return (await getProject(orgId, id))!
}

/** Display name is editable in Settings; the slug follows app.json so the CLI can find the project. */
export const renameProject = async (orgId: string, id: string, name: string) =>
  await db.run('UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND org_id = ?', name.trim(), Date.now(), id, orgId)

export const deleteProject = async (orgId: string, id: string) =>
  await db.run('DELETE FROM projects WHERE id = ? AND org_id = ?', id, orgId)
