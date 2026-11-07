import { db } from './db'

import { mergeLimits, type BuildLimits } from '@/lib/limits-types'

const read = async (orgId: string, machine: string): Promise<BuildLimits | null> => {
  const row = (await db.one('SELECT limits_json FROM build_limits WHERE org_id = ? AND machine = ?', orgId, machine)) as
    | { limits_json: string }
    | undefined

  return row ? (JSON.parse(row.limits_json) as BuildLimits) : null
}

export const getOrgDefaultLimits = (orgId: string) => read(orgId, '')

export const getMachineLimits = (orgId: string, machine: string) => read(orgId, machine)

/** What the CLI applies on this machine: its own limits over the organization default. */
export const getEffectiveLimits = async (orgId: string, machine: string | null) => {
  const org = await read(orgId, '')
  const own = machine ? await read(orgId, machine) : null

  return { limits: mergeLimits(org, own), org, machine: own }
}

export const listMachineLimits = async (orgId: string) =>
  new Map(
    ((await db.all("SELECT machine, limits_json FROM build_limits WHERE org_id = ? AND machine != ''", orgId)) as { machine: string; limits_json: string }[]).map(
      r => [r.machine, JSON.parse(r.limits_json) as BuildLimits]
    )
  )

/** machine '' = organization default. Empty limits delete the row. */
export const saveLimits = async (orgId: string, machine: string, limits: BuildLimits) => {
  const clean = Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined && v !== null))

  if (!Object.keys(clean).length) {
    await db.run('DELETE FROM build_limits WHERE org_id = ? AND machine = ?', orgId, machine)

    return
  }

  await db.run(`INSERT INTO build_limits (org_id, machine, limits_json, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (org_id, machine) DO UPDATE SET limits_json = excluded.limits_json, updated_at = excluded.updated_at`, orgId, machine, JSON.stringify(clean), Date.now())
}
