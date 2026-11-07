/**
 * What button-style server actions return. They never call redirect() themselves: the client shows a
 * toast, navigates to `redirectTo` and refreshes the layout (sidebar), so nothing is left stale.
 */
export type ActionResult = { ok?: boolean; error?: string; redirectTo?: string; message?: string }

/** Runs an action body and turns thrown errors into `{ error }` (production hides thrown messages). */
export const guard = async (fn: () => Promise<ActionResult | void>): Promise<ActionResult> => {
  try {
    return (await fn()) ?? { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong.' }
  }
}
