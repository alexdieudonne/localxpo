import { decryptSecret, encryptSecret, newId } from './crypto'
import { db } from './db'

export const ENVIRONMENTS = ['development', 'preview', 'production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/

export type EnvVar = {
  id: string
  name: string
  environment: Environment
  secret: boolean

  /** Plain text for non-secret vars; null for secrets (never sent to the browser). */
  value: string | null
  preview: string
  updated_at: number
}

type Row = { id: string; name: string; environment: Environment; value_enc: string; secret: number; updated_at: number }

const mask = (v: string) => (v.length <= 4 ? '••••' : `${'•'.repeat(Math.min(v.length - 4, 12))}${v.slice(-4)}`)

export const listEnvVars = async (projectId: string): Promise<EnvVar[]> =>
  (
    ((await db.all('SELECT * FROM env_vars WHERE project_id = ? ORDER BY name, environment', projectId)) as Row[])
  ).map(r => {
    const value = decryptSecret(r.value_enc)

    return {
      id: r.id,
      name: r.name,
      environment: r.environment,
      secret: Boolean(r.secret),
      value: r.secret ? null : value,
      preview: r.secret ? mask(value) : value,
      updated_at: r.updated_at
    }
  })

/** Creates or replaces NAME for each of the given environments. */
export const setEnvVar = async (projectId: string, input: { name: string; value: string; environments: Environment[]; secret: boolean }) => {
  const now = Date.now()

  await db.tx(async t => {
    for (const env of input.environments) {
      await t.run(`INSERT INTO env_vars (id, project_id, name, environment, value_enc, secret, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (project_id, name, environment) DO UPDATE SET value_enc = excluded.value_enc, secret = excluded.secret, updated_at = excluded.updated_at`, newId(), projectId, input.name, env, encryptSecret(input.value), input.secret ? 1 : 0, now, now)
    }
  })
}

export const deleteEnvVar = async (projectId: string, id: string) =>
  await db.run('DELETE FROM env_vars WHERE id = ? AND project_id = ?', id, projectId)

/** Decrypted map for one environment (CLI only). */
export const envForEnvironment = async (projectId: string, environment: Environment) => {
  const rows = (await db.all('SELECT name, value_enc, secret FROM env_vars WHERE project_id = ? AND environment = ?', projectId, environment)) as { name: string; value_enc: string; secret: number }[]

  return rows.map(r => ({ name: r.name, value: decryptSecret(r.value_enc), secret: Boolean(r.secret) }))
}

/** Same rule as EAS: profile.environment if set, otherwise by profile name, otherwise production. */
export const environmentForProfile = (profile: string, explicit?: string | null): Environment => {
  if (explicit && (ENVIRONMENTS as readonly string[]).includes(explicit)) return explicit as Environment
  if ((ENVIRONMENTS as readonly string[]).includes(profile)) return profile as Environment
  if (/dev/i.test(profile)) return 'development'
  if (/preview|staging|beta|internal/i.test(profile)) return 'preview'

  return 'production'
}
