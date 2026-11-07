// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { apiError, json, parseBody } from '@/lib/server/api'
import { checkCredentials, clearFailedLogins, clientIp, createApiToken, loginRetryAfter, recordFailedLogin, retryMessage } from '@/lib/server/auth'
import { listOrgsForUser } from '@/lib/server/orgs'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().max(100).optional()
})

/** Exchanges email + password for a long-lived API token (used by `localxpo login`). */
export const POST = async (req: Request) => {
  const body = await parseBody(req, schema)

  if (!body.ok) return body.response

  const ip = clientIp(req.headers)
  const wait = await loginRetryAfter(body.data.email, ip)

  if (wait) return apiError(429, retryMessage(wait))

  const user = await checkCredentials(body.data.email, body.data.password)

  if (!user) {
    await recordFailedLogin(body.data.email, ip)

    return apiError(401, 'Wrong email or password.')
  }

  await clearFailedLogins(body.data.email)

  const { token } = await createApiToken(user.id, `CLI · ${body.data.deviceName ?? 'unknown machine'}`)

  return json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
    orgs: (await listOrgsForUser(user.id)).map(o => ({ slug: o.slug, name: o.name, role: o.role }))
  })
}
