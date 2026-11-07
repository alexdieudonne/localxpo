// Next Imports
import { NextResponse } from 'next/server'

// Lib Imports
import { handleWebhook } from '@/lib/server/stripe'

/**
 * Stripe → localxpo. In the Stripe dashboard (or `stripe listen --forward-to localhost:3000/api/stripe/webhook`)
 * send checkout.session.completed, customer.subscription.*, invoice.paid and invoice.payment_failed here.
 */
export const POST = async (req: Request) => {
  try {
    // The signature covers the exact bytes Stripe sent: read the raw body, never re-serialized JSON.
    const result = await handleWebhook(await req.text(), req.headers.get('stripe-signature'))

    return NextResponse.json(result)
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500

    console.error('[stripe webhook]', (e as Error).message)

    return NextResponse.json({ error: status === 400 ? 'Invalid webhook request' : 'Webhook handling failed' }, { status })
  }
}
