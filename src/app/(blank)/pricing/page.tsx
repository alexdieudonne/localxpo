// Next Imports
import Link from 'next/link'
import { notFound } from 'next/navigation'

// Component Imports
import Logo from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import JsonLd from '@/components/shared/JsonLd'
import PlanCards from '@/views/billing/plan-cards'

// Lib Imports
import { formatPrice, PAYMENT_GRACE_DAYS, PLANS, TRIAL_DAYS } from '@/lib/plans'
import { getCurrentUser } from '@/lib/server/auth'
import { isCloud } from '@/lib/server/billing'
import { faqJsonLd } from '@/lib/seo'
import { OG_IMAGES } from '@/lib/site'

export const dynamic = 'force-dynamic'

const TITLE = `Pricing: free local Expo builds, Pro from ${formatPrice(PLANS.pro.price.month)}/month | localxpo`

const DESCRIPTION =
  `localxpo Cloud is free for one machine. Pro ${formatPrice(PLANS.pro.price.month)}, Team ${formatPrice(PLANS.team.price.month)}, Business ${formatPrice(PLANS.business.price.month)} per organization per month, with a ${TRIAL_DAYS}-day free trial. No build minutes: builds run on your hardware. Self-hosting is free.`

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/pricing' },
  openGraph: { type: 'website', siteName: 'localxpo', url: '/pricing', title: TITLE, description: DESCRIPTION, images: OG_IMAGES }
}

const FAQ = [
  {
    q: 'Where do builds run?',
    a: 'On your own Macs and PCs, through the localxpo CLI. No build minutes to buy: the plan covers the dashboard, history, team and automation features.'
  },
  {
    q: 'How does the trial work?',
    a: `Every paid plan starts with a ${TRIAL_DAYS}-day free trial. Cancel before it ends and nothing is charged.`
  },
  {
    q: 'What happens if a payment fails?',
    a: `The card is retried and your plan stays active for ${PAYMENT_GRACE_DAYS} days. After that the organization falls back to Free until the payment goes through; nothing is deleted except history older than Free keeps.`
  },
  {
    q: 'Can I self-host instead?',
    a: 'Yes. The self-hosted dashboard is free with every feature unlocked; Cloud is for teams that would rather not run a server.'
  },
  { q: 'Can I change or cancel later?', a: 'Any time, from the Billing page. Upgrades are prorated; cancelling keeps the plan until the end of the paid period.' }
]

const PricingPage = async () => {
  if (!isCloud()) notFound()

  const user = await getCurrentUser()

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6'>
      <header className='flex items-center justify-between gap-4'>
        <Link href='/'>
          <Logo />
        </Link>
        <div className='flex items-center gap-2'>
          {user ? (
            <Button render={<Link href='/' />} nativeButton={false}>
              Open dashboard
            </Button>
          ) : (
            <>
              <Button variant='ghost' render={<Link href='/login' />} nativeButton={false}>
                Sign in
              </Button>
              <Button render={<Link href='/register' />} nativeButton={false}>
                Create account
              </Button>
            </>
          )}
        </div>
      </header>

      <section className='mx-auto max-w-2xl py-12 text-center'>
        <h1 className='text-4xl font-semibold tracking-tight text-balance'>localxpo pricing: free local Expo builds, pay when the team grows</h1>
        <p className='text-muted-foreground mt-3 text-lg text-pretty'>
          Your machines build, localxpo keeps track: live logs, metrics, store submissions and a shared history for your Expo apps. Pick a plan per
          organization; start free. Prefer your own server?{' '}
          <Link href='/docs#self-host' className='text-foreground underline underline-offset-4'>
            Self-hosting is free
          </Link>
          .
        </p>
      </section>

      <PlanCards mode='public' />

      <section className='mx-auto max-w-3xl py-16'>
        <h2 className='mb-6 text-center text-2xl font-semibold'>Questions</h2>
        <dl className='divide-y rounded-xl border'>
          {FAQ.map(f => (
            <div key={f.q} className='p-5'>
              <dt className='font-medium'>{f.q}</dt>
              <dd className='text-muted-foreground mt-1.5 text-sm'>{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className='text-muted-foreground mt-6 text-center text-sm'>
          More questions? Read the{' '}
          <Link href='/docs' className='text-foreground underline underline-offset-4'>
            developer docs
          </Link>{' '}
          or see{' '}
          <Link href='/' className='text-foreground underline underline-offset-4'>
            how localxpo works
          </Link>
          .
        </p>
      </section>
      <JsonLd data={faqJsonLd(FAQ)} />
    </div>
  )
}

export default PricingPage
