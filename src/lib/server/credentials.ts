import { db } from './db'
import { decryptSecret, encryptSecret, newId } from './crypto'

export const CREDENTIAL_KINDS = ['apple_asc_key', 'google_service_account', 'android_keystore'] as const
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number]

export type AppleAscKeyMeta = { keyId: string; issuerId: string; teamId: string; teamName?: string }
export type GoogleServiceAccountMeta = { clientEmail: string; projectId: string }
export type AndroidKeystoreMeta = { keyAlias: string; sha1?: string; sha256?: string; androidPackage?: string }

/** Public view: never contains the secret. */
export type Credential = {
  id: string
  project_id: string | null
  kind: CredentialKind
  label: string
  meta: Record<string, string>
  created_at: number
  updated_at: number
  project_name?: string | null
}

type Row = Omit<Credential, 'meta'> & { meta_json: string; secret_enc: string; project_name?: string | null }

const toPublic = (r: Row): Credential => ({
  id: r.id,
  project_id: r.project_id,
  kind: r.kind,
  label: r.label,
  meta: JSON.parse(r.meta_json),
  created_at: r.created_at,
  updated_at: r.updated_at,
  project_name: r.project_name
})

export const listCredentials = async (orgId: string, projectId?: string) =>
  (
    ((await db.all(`SELECT c.*, p.name AS project_name FROM credentials c LEFT JOIN projects p ON p.id = c.project_id
         WHERE c.org_id = ? ${projectId ? 'AND c.project_id = ?' : ''} ORDER BY c.kind, c.updated_at DESC`, ...(projectId ? [orgId, projectId] : [orgId]))) as Row[])
  ).map(toPublic)

/**
 * Save a credential. Organization-level kinds (Apple key, Google service account) keep one active entry
 * per organization; android_keystore keeps one per project.
 */
export const saveCredential = async (
  orgId: string,
  userId: string,
  input: { kind: CredentialKind; label: string; meta: object; secret: object; projectId?: string | null }
): Promise<Credential> => {
  const now = Date.now()
  const projectId = input.projectId ?? null

  // Keystores are per Android package (a project can ship several apps, e.g. one per profile).
  const pkg = input.kind === 'android_keystore' ? ((input.meta as AndroidKeystoreMeta).androidPackage ?? null) : null
  const samePkg = pkg ? " AND (meta_json::jsonb ->> 'androidPackage') = ?" : ''
  const scope = [orgId, input.kind, projectId, ...(pkg ? [pkg] : [])]

  const existing = (await db.one(`SELECT id FROM credentials WHERE org_id = ? AND kind = ? AND project_id IS NOT DISTINCT FROM ?${samePkg}`, ...scope)) as { id: string } | undefined

  const secretEnc = encryptSecret(JSON.stringify(input.secret))

  if (existing) {
    await db.run('UPDATE credentials SET label = ?, meta_json = ?, secret_enc = ?, updated_at = ? WHERE id = ?', input.label,
      JSON.stringify(input.meta),
      secretEnc,
      now,
      existing.id)
  } else {
    const id = newId()

    await db.run(`INSERT INTO credentials (id, org_id, user_id, project_id, kind, label, meta_json, secret_enc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, orgId, userId, projectId, input.kind, input.label, JSON.stringify(input.meta), secretEnc, now, now)

    return toPublic(((await db.one('SELECT * FROM credentials WHERE id = ?', id)) as Row))
  }

  const row = ((await db.one('SELECT * FROM credentials WHERE id = ?', existing.id)) as Row)

  return toPublic(row)
}

const findCredentialRow = async (orgId: string, kind: CredentialKind, projectId?: string | null, androidPackage?: string | null) =>
  ((await db.one(`SELECT * FROM credentials WHERE org_id = ? AND kind = ? AND project_id IS NOT DISTINCT FROM ?
       ${androidPackage ? "AND (meta_json::jsonb ->> 'androidPackage') = ?" : ''} ORDER BY updated_at DESC LIMIT 1`, orgId, kind, projectId ?? null, ...(androidPackage ? [androidPackage] : []))) as Row | undefined)

/** Public view (no secret) of the matching credential, or null. */
export const findCredential = async (orgId: string, kind: CredentialKind, projectId?: string | null, androidPackage?: string | null) => {
  const row = await findCredentialRow(orgId, kind, projectId, androidPackage)

  return row ? toPublic(row) : null
}

/** Decrypted credential, for the CLI only (bearer-token requests). */
export const getCredentialWithSecret = async (orgId: string, kind: CredentialKind, projectId?: string | null, androidPackage?: string | null) => {
  const row = await findCredentialRow(orgId, kind, projectId, androidPackage)

  if (!row) return null

  return { ...toPublic(row), secret: JSON.parse(decryptSecret(row.secret_enc)) as Record<string, string> }
}

export const deleteCredential = async (orgId: string, id: string) =>
  await db.run('DELETE FROM credentials WHERE id = ? AND org_id = ?', id, orgId)
