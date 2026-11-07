// Next Imports
import { NextResponse } from 'next/server'

// Third-party Imports
import type { z } from 'zod'

import { authenticateRequest, type RequestAuth } from './auth'

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === 'number' ? { status: init } : init)

export const apiError = (status: number, message: string, details?: unknown) =>
  NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status })

type Ctx<P> = { params: Promise<P> }

/** Wraps a route handler with auth + JSON error handling. */
export const withAuth =
  <P = Record<string, never>>(
    handler: (req: Request, auth: RequestAuth, params: P) => Promise<Response> | Response,
    opts: { tokenOnly?: boolean } = {}
  ) =>
  async (req: Request, ctx: Ctx<P>) => {
    const auth = await authenticateRequest(req)

    if (!auth) return apiError(401, 'Not signed in. Run `localxpo login` or pass a valid API token.')
    if (opts.tokenOnly && auth.via !== 'token') return apiError(403, 'This endpoint needs an API token.')

    try {
      return await handler(req, auth, await ctx.params)
    } catch (err) {
      console.error('[api]', err)

      // Show the cause while developing; keep details private in production.
      return apiError(500, process.env.NODE_ENV === 'production' ? 'Internal error' : `Internal error: ${(err as Error).message}`)
    }
  }

/** Request bodies above this are refused before parsing (logs are the largest: about 1 MB per batch at most). */
const MAX_BODY_BYTES = 4 * 1024 * 1024

export const parseBody = async <T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = MAX_BODY_BYTES) => {
  let body: unknown

  const declared = Number(req.headers.get('content-length') ?? 0)

  if (declared > maxBytes) return { ok: false as const, response: apiError(413, 'Request body too large') }

  try {
    const text = await req.text()

    if (text.length > maxBytes) return { ok: false as const, response: apiError(413, 'Request body too large') }
    body = JSON.parse(text)
  } catch {
    return { ok: false as const, response: apiError(400, 'Body must be JSON') }
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) return { ok: false as const, response: apiError(422, 'Invalid request', parsed.error.flatten()) }

  return { ok: true as const, data: parsed.data as z.infer<T> }
}

/** Integer query parameter, clamped (fractions, negatives, NaN or Infinity can't reach SQL). */
export const intParam = (value: string | null, fallback: number, min: number, max: number) => {
  const n = Math.trunc(Number(value ?? NaN))

  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
