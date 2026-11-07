// Lib Imports
import { CURRENCY, PLAN_ORDER, PLANS } from '@/lib/plans'
import { REPO_URL, siteUrl } from '@/lib/site'

const CUR = CURRENCY.toUpperCase()

/** Organization + SoftwareApplication, with offers built from the real plans so prices never drift. */
export const productJsonLd = () => {
  const base = siteUrl()

  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${base}/#org`, name: 'localxpo', url: base, logo: `${base}/images/icon-512.png`, sameAs: [REPO_URL] },
      {
        '@type': 'SoftwareApplication',
        name: 'localxpo',
        url: base,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Windows, Linux',
        license: 'https://opensource.org/licenses/MIT',
        isAccessibleForFree: true,
        publisher: { '@id': `${base}/#org` },
        image: `${base}/opengraph-image.png`,
        description:
          'Open-source dashboard and CLI to build, sign and submit Expo (React Native) iOS and Android apps on your own machines with fastlane.',
        offers: PLAN_ORDER.map(id => {
          const plan = PLANS[id]
          const price = String(plan.price.month)

          return plan.price.month === 0
            ? { '@type': 'Offer', name: plan.name, price, priceCurrency: CUR }
            : {
                '@type': 'Offer',
                name: plan.name,
                price,
                priceCurrency: CUR,
                priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: CUR, unitText: 'MONTH' }
              }
        })
      }
    ]
  }
}

export const faqJsonLd = (faq: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
})
