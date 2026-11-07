// Next Imports
import type { MetadataRoute } from 'next'

// Lib Imports
import { indexable, siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

const robots = (): MetadataRoute.Robots => {
  if (!indexable()) return { rules: [{ userAgent: '*', disallow: '/' }] }

  return {
    rules: [{ userAgent: '*', allow: ['/', '/docs', '/pricing', '/register'], disallow: ['/api/', '/login', '/account', '/landing'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl()
  }
}

export default robots
