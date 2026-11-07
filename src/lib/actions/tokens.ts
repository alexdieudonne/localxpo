'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { createApiToken, requireUser, revokeApiToken } from '@/lib/server/auth'

export type TokenState = { token?: string; error?: string }

export const createTokenAction = async (_prev: TokenState, formData: FormData): Promise<TokenState> => {
  const user = await requireUser()
  const name = String(formData.get('name') ?? '').trim()

  if (!name) return { error: 'Give the token a name, e.g. "Mac mini" or "GitHub Actions".' }
  if (name.length > 80) return { error: 'Name is too long.' }

  const { token } = await createApiToken(user.id, name)

  revalidatePath('/account/tokens')

  return { token }
}

export const revokeTokenAction = async (id: string): Promise<ActionResult> =>
  guard(async () => {
    const user = await requireUser()

    await revokeApiToken(user.id, id)
    revalidatePath('/account/tokens')
  })
