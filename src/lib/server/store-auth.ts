// Node Imports
import crypto from 'node:crypto'

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

const signJwt = (header: object, payload: object, key: string, alg: 'ES256' | 'RS256') => {
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`

  const signature = crypto.sign('sha256', Buffer.from(data), {
    key,
    ...(alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {})
  })

  return `${data}.${b64url(signature)}`
}

export type CheckResult = { ok: true; detail?: string } | { ok: false; reason: 'rejected' | 'unreachable'; message: string }

/** Calls App Store Connect with a short-lived JWT signed by the .p8 key. */
export const checkAppleKey = async (keyId: string, issuerId: string, p8: string): Promise<CheckResult> => {
  let token: string

  try {
    const now = Math.floor(Date.now() / 1000)

    token = signJwt(
      { alg: 'ES256', kid: keyId, typ: 'JWT' },
      { iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' },
      p8,
      'ES256'
    )
  } catch {
    return { ok: false, reason: 'rejected', message: 'The .p8 file is not a valid private key.' }
  }

  try {
    const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=200&fields[apps]=bundleId', {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000)
    })

    if (res.status === 401) return { ok: false, reason: 'rejected', message: 'Apple rejected the key: check the Key ID and Issuer ID.' }
    if (res.status === 403) return { ok: false, reason: 'rejected', message: 'The key works but lacks permissions. Use the App Manager or Admin role.' }
    if (!res.ok) return { ok: false, reason: 'unreachable', message: `App Store Connect answered ${res.status}.` }

    const body = (await res.json()) as { data?: unknown[] }

    return { ok: true, detail: `${body.data?.length ?? 0} app(s) visible` }
  } catch {
    return { ok: false, reason: 'unreachable', message: 'Could not reach App Store Connect to verify the key.' }
  }
}

/** Exchanges a service-account JWT for an OAuth token (proves the key is valid and enabled). */
export const checkGoogleServiceAccount = async (clientEmail: string, privateKey: string): Promise<CheckResult> => {
  let assertion: string

  try {
    const now = Math.floor(Date.now() / 1000)

    assertion = signJwt(
      { alg: 'RS256', typ: 'JWT' },
      {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 600
      },
      privateKey,
      'RS256'
    )
  } catch {
    return { ok: false, reason: 'rejected', message: 'The private_key in this JSON file is not valid.' }
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(10_000)
    })

    if (res.status === 400 || res.status === 401)
      return { ok: false, reason: 'rejected', message: 'Google rejected this service account key (deleted or disabled?).' }
    if (!res.ok) return { ok: false, reason: 'unreachable', message: `Google answered ${res.status}.` }

    return { ok: true }
  } catch {
    return { ok: false, reason: 'unreachable', message: 'Could not reach Google to verify the key.' }
  }
}
