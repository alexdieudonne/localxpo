// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody, withAuth } from '@/lib/server/api'
import { CREDENTIAL_KINDS, findCredential, getCredentialWithSecret, saveCredential, type CredentialKind } from '@/lib/server/credentials'
import { db } from '@/lib/server/db'
import { getRole } from '@/lib/server/orgs'
import { getProjectForUser } from '@/lib/server/projects'
import { checkAppleKey, checkGoogleServiceAccount } from '@/lib/server/store-auth'

const hasActiveRun = async (userId: string, projectId: string) =>
  Boolean(
    await db.one(
      `SELECT 1 FROM builds WHERE project_id = ? AND user_id = ? AND status = 'in_progress'
       UNION ALL SELECT 1 FROM submissions WHERE project_id = ? AND user_id = ? AND status IN ('queued', 'in_progress') LIMIT 1`,
      projectId,
      userId,
      projectId,
      userId
    )
  )

/**
 * GET ?kind=apple_asc_key|google_service_account|android_keystore&projectId=...[&androidPackage=...]
 *   → the decrypted credential of the project's organization (CLI only, API token required).
 * GET ?summary=1&projectId=...[&androidPackage=...]
 *   → which credentials exist (no secrets): what `localxpo link` / `credentials` still has to set up.
 * Apple / Google keys are org-level; Android keystores are per project and per package.
 */
export const GET = withAuth(
  async (req, { user }) => {
    const url = new URL(req.url)
    const project = await getProjectForUser(user.id, url.searchParams.get('projectId') ?? '')
    const androidPackage = url.searchParams.get('androidPackage')

    if (!project) return apiError(404, 'Project not found')

    if (url.searchParams.get('summary')) {
      return json({
        apple: await findCredential(project.org_id, 'apple_asc_key'),
        google: await findCredential(project.org_id, 'google_service_account'),
        keystore: androidPackage ? await findCredential(project.org_id, 'android_keystore', project.id, androidPackage) : null,
        canEditOrgKeys: await getRole(user.id, project.org_id) === 'owner'
      })
    }

    const kind = url.searchParams.get('kind')

    if (!kind || !(CREDENTIAL_KINDS as readonly string[]).includes(kind)) return apiError(400, 'Unknown credential kind')

    // Store keys are powerful (publish apps, sign releases). Owners can always download them; members only while
    // one of their own builds or uploads is running in this project, which is when the CLI needs them.
    if ((await getRole(user.id, project.org_id)) !== 'owner' && !(await hasActiveRun(user.id, project.id)))
      return apiError(403, 'Store keys are only available to organization owners, or to members during one of their running builds or uploads.')

    const isKeystore = kind === 'android_keystore'
    const credential = await getCredentialWithSecret(project.org_id, kind as CredentialKind, isKeystore ? project.id : null, isKeystore ? androidPackage : null)

    return json({ credential })
  },
  { tokenOnly: true }
)

// The CLI uploads keys it generates (Android keystore) or finds on the machine / imports from EAS.
const keystore = z.object({
  kind: z.literal('android_keystore'),
  projectId: z.string().min(1),
  label: z.string().min(1).max(200),
  meta: z.object({
    keyAlias: z.string().min(1).max(100),
    sha1: z.string().max(200).optional(),
    sha256: z.string().max(200).optional(),
    androidPackage: z.string().min(1).max(200),
    source: z.string().max(100).optional()
  }),
  secret: z.object({
    keystoreBase64: z.string().min(1).max(200_000),
    keystorePassword: z.string().min(1).max(200),
    keyAlias: z.string().min(1).max(100),
    keyPassword: z.string().min(1).max(200)
  })
})

const apple = z.object({
  kind: z.literal('apple_asc_key'),
  projectId: z.string().min(1),
  meta: z.object({
    keyId: z.string().regex(/^[A-Z0-9]{10}$/, 'Key ID is 10 letters/digits'),
    issuerId: z.string().regex(/^[0-9a-f-]{36}$/i, 'Issuer ID is a UUID'),
    teamId: z.string().regex(/^[A-Z0-9]{10}$/, 'Team ID is 10 letters/digits'),
    teamName: z.string().max(100).optional(),
    source: z.string().max(100).optional()
  }),
  secret: z.object({ p8: z.string().min(1).max(10_000) })
})

const google = z.object({
  kind: z.literal('google_service_account'),
  projectId: z.string().min(1),
  meta: z.object({ source: z.string().max(100).optional() }).optional(),
  secret: z.object({ json: z.string().min(1).max(20_000) })
})

const schema = z.discriminatedUnion('kind', [keystore, apple, google])

export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, schema)

    if (!body.ok) return body.response

    const project = await getProjectForUser(user.id, body.data.projectId)

    if (!project) return apiError(404, 'Project not found')

    const data = body.data
    let verified: string | null = null

    if (data.kind !== 'android_keystore' && await getRole(user.id, project.org_id) !== 'owner')
      return apiError(403, 'Only organization owners can set store keys. Ask an owner to run `npx localxpo credentials`.')

    if (data.kind === 'apple_asc_key') {
      if (!data.secret.p8.includes('BEGIN PRIVATE KEY')) return apiError(422, 'This is not a .p8 private key.')

      const check = await checkAppleKey(data.meta.keyId, data.meta.issuerId, data.secret.p8)

      if (!check.ok && check.reason === 'rejected') return apiError(422, check.message)
      verified = check.ok ? `verified with Apple${check.detail ? ` (${check.detail})` : ''}` : `not verified: ${check.message}`

      const { source, ...meta } = data.meta

      const credential = await saveCredential(project.org_id, user.id, {
        kind: 'apple_asc_key',
        label: meta.teamName ? `${meta.teamName} (${meta.teamId})` : `Team ${meta.teamId}`,
        meta: { ...meta, ...(source ? { source } : {}) },
        secret: data.secret
      })

      revalidatePath('/', 'layout')

      return json({ credential, verified }, 201)
    }

    if (data.kind === 'google_service_account') {
      let key: Record<string, string>

      try {
        key = JSON.parse(data.secret.json)
      } catch {
        return apiError(422, 'The service account file is not valid JSON.')
      }

      if (key.type !== 'service_account' || !key.client_email || !key.private_key)
        return apiError(422, 'Expected a Google Cloud service account key (type "service_account").')

      const check = await checkGoogleServiceAccount(key.client_email, key.private_key)

      if (!check.ok && check.reason === 'rejected') return apiError(422, check.message)
      verified = check.ok ? 'verified with Google' : `not verified: ${check.message}`

      const credential = await saveCredential(project.org_id, user.id, {
        kind: 'google_service_account',
        label: key.client_email,
        meta: { clientEmail: key.client_email, projectId: key.project_id ?? '', ...(data.meta?.source ? { source: data.meta.source } : {}) },
        secret: { json: data.secret.json }
      })

      revalidatePath('/', 'layout')

      return json({ credential, verified }, 201)
    }

    // An upload keystore is the app's identity on Google Play: never replace an existing one from the CLI unless
    // an owner does it (losing it means a Play upload-key reset).
    if ((await findCredential(project.org_id, 'android_keystore', project.id, data.meta.androidPackage)) && (await getRole(user.id, project.org_id)) !== 'owner')
      return apiError(409, `A keystore for ${data.meta.androidPackage} already exists. Only an owner can replace it, from the Credentials page.`)

    return json({ credential: await saveCredential(project.org_id, user.id, { ...data, projectId: project.id }) }, 201)
  },
  { tokenOnly: true }
)
