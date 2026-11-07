'use server'

// Next Imports
import { revalidatePath } from 'next/cache'

// Third-party Imports
import { z } from 'zod'

// Lib Imports
import { guard, type ActionResult } from '@/lib/action-result'
import { describeLimits, type BuildLimits } from '@/lib/limits-types'
import { saveLimits } from '@/lib/server/limits'
import { requireOrgAction } from '@/lib/server/orgs'

const schema = z.object({
  gradleHeapGb: z.number().int().min(1).max(64).nullable(),
  maxWorkers: z.number().int().min(1).max(128).nullable(),
  priority: z.enum(['normal', 'low']).nullable(),
  stopDaemons: z.boolean().nullable()
})

/** machine '' = organization default. Any member can set limits (they only slow builds down, never leak anything). */
export const saveLimitsAction = async (orgSlug: string, machine: string, limits: BuildLimits): Promise<ActionResult> =>
  guard(async () => {
    const { org } = await requireOrgAction(orgSlug)

    const parsed = schema.safeParse({
      gradleHeapGb: limits.gradleHeapGb ?? null,
      maxWorkers: limits.maxWorkers ?? null,
      priority: limits.priority ?? null,
      stopDaemons: limits.stopDaemons ?? null
    })

    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid limits.' }

    await saveLimits(org.id, machine, parsed.data)
    revalidatePath(`/${org.slug}/machines`)

    const summary = describeLimits(parsed.data)

    return {
      ok: true,
      message: summary.length
        ? `${machine ? machine : 'Default'} limits saved: ${summary.join(', ')}. They apply from the next build.`
        : `${machine ? `${machine} now uses the defaults` : 'Default limits removed'}.`
    }
  })
