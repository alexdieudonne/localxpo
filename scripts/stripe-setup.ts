/**
 * One-time (and re-runnable) Stripe setup for localxpo Cloud:
 *   - a product per paid plan, with a monthly and a yearly price found by lookup key (localxpo_pro_month, …);
 *   - a Customer Portal configuration that lets customers switch between those prices, update their card,
 *     see invoices and cancel at the end of the period;
 *   - optionally the webhook endpoint (--webhook-url https://your-domain/api/stripe/webhook), whose signing
 *     secret is added to .env.local.
 *
 *   pnpm stripe:setup
 *   pnpm stripe:setup --webhook-url https://cloud.example.com/api/stripe/webhook
 *
 * Reads STRIPE_SECRET_KEY from the environment, .env.local or .env. Safe to run again: existing prices are
 * kept; a changed amount creates a new price and moves the lookup key to it (current subscribers keep theirs).
 */
import fs from 'node:fs'
import path from 'node:path'

import Stripe from 'stripe'

import { CURRENCY, lookupKey, PAID_PLANS, PLANS, type BillingInterval, type PaidPlanId } from '../src/lib/plans'

const ROOT = process.cwd()
const ENV_FILES = ['.env.local', '.env']

const readEnv = (name: string) => {
  if (process.env[name]) return process.env[name]

  for (const f of ENV_FILES) {
    const file = path.join(ROOT, f)

    if (!fs.existsSync(file)) continue

    const m = new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\n]+)"?`, 'm').exec(fs.readFileSync(file, 'utf8'))

    if (m) return m[1].trim()
  }

  return undefined
}

const appendEnv = (name: string, value: string) => {
  const file = path.join(ROOT, '.env.local')
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''

  if (new RegExp(`^\\s*${name}\\s*=`, 'm').test(text)) return false

  fs.writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${name}=${value}\n`, { mode: 0o600 })

  return true
}

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed'
]

const main = async () => {
  const key = readEnv('STRIPE_SECRET_KEY')

  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set. Add it to .env.local (Stripe dashboard → Developers → API keys), then run this again.')
    process.exit(1)
  }

  const webhookArg = process.argv.indexOf('--webhook-url')
  const webhookUrl = webhookArg > 0 ? process.argv[webhookArg + 1] : undefined
  const stripe = new Stripe(key, { appInfo: { name: 'localxpo-setup' } })
  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'test'

  console.log(`Stripe (${mode} mode)\n`)

  // ---------- Products and prices ----------

  const products = (await stripe.products.list({ active: true, limit: 100 })).data
  const portalProducts: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] = []

  for (const planId of PAID_PLANS) {
    const plan = PLANS[planId]
    let product = products.find(p => p.metadata.localxpo_plan === planId)

    if (!product) {
      product = await stripe.products.create({
        name: `localxpo ${plan.name}`,
        description: plan.tagline,
        metadata: { localxpo_plan: planId }
      })
      console.log(`+ product  ${product.name}`)
    } else if (product.name !== `localxpo ${plan.name}` || product.description !== plan.tagline) {
      product = await stripe.products.update(product.id, { name: `localxpo ${plan.name}`, description: plan.tagline })
    }

    const priceIds: string[] = []

    for (const interval of ['month', 'year'] as BillingInterval[]) {
      const lk = lookupKey(planId as PaidPlanId, interval)
      const amount = plan.price[interval] * 100
      const existing = (await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 })).data[0]

      if (existing && existing.unit_amount === amount && existing.currency === CURRENCY && existing.product === product.id) {
        console.log(`= price    ${lk.padEnd(26)} €${plan.price[interval]}/${interval}`)
        priceIds.push(existing.id)
        continue
      }

      const price = await stripe.prices.create({
        product: product.id,
        currency: CURRENCY,
        unit_amount: amount,
        recurring: { interval },
        lookup_key: lk,
        transfer_lookup_key: true,
        nickname: `${plan.name} ${interval === 'month' ? 'monthly' : 'yearly'}`,
        metadata: { localxpo_plan: planId, interval }
      })

      console.log(`${existing ? '~' : '+'} price    ${lk.padEnd(26)} €${plan.price[interval]}/${interval}${existing ? ' (amount changed: new price, lookup key moved)' : ''}`)
      priceIds.push(price.id)
    }

    portalProducts.push({ product: product.id, prices: priceIds })
  }

  // ---------- Customer Portal ----------

  const portal: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: { headline: 'localxpo: manage your plan, card and invoices' },
    metadata: { localxpo: '1' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] }
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: portalProducts
      }
    }
  }

  const existingPortal = (await stripe.billingPortal.configurations.list({ active: true, limit: 20 })).data.find(c => c.metadata?.localxpo === '1')

  if (existingPortal) {
    await stripe.billingPortal.configurations.update(existingPortal.id, {
      business_profile: portal.business_profile,
      features: portal.features as Stripe.BillingPortal.ConfigurationUpdateParams.Features
    })
    console.log(`= portal   ${existingPortal.id} (updated)`)
  } else {
    const created = await stripe.billingPortal.configurations.create(portal)

    console.log(`+ portal   ${created.id}`)
  }

  // ---------- Webhook ----------

  if (webhookUrl) {
    const endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data
    const found = endpoints.find(e => e.url === webhookUrl)

    if (found) {
      await stripe.webhookEndpoints.update(found.id, { enabled_events: WEBHOOK_EVENTS })
      console.log(`= webhook  ${webhookUrl} (events updated; its signing secret is in the Stripe dashboard)`)
    } else {
      const created = await stripe.webhookEndpoints.create({ url: webhookUrl, enabled_events: WEBHOOK_EVENTS, description: 'localxpo Cloud billing' })

      console.log(`+ webhook  ${webhookUrl}`)

      if (created.secret && appendEnv('STRIPE_WEBHOOK_SECRET', created.secret)) console.log('  STRIPE_WEBHOOK_SECRET added to .env.local')
      else if (created.secret) console.log('  .env.local already has STRIPE_WEBHOOK_SECRET: replace it with the new endpoint\'s secret from the Stripe dashboard.')
    }
  }

  console.log('\nDone. Plans are ready for checkout.')

  if (!webhookUrl) {
    console.log('\nWebhooks while developing (Stripe CLI):')
    console.log('  stripe listen --forward-to localhost:3000/api/stripe/webhook')
    console.log('  → put the printed whsec_… in .env.local as STRIPE_WEBHOOK_SECRET and restart pnpm dev.')
    console.log('In production: pnpm stripe:setup --webhook-url https://<your-domain>/api/stripe/webhook')
  }
}

main().catch(e => {
  console.error(`\n✖ ${(e as Error).message}`)
  process.exit(1)
})
