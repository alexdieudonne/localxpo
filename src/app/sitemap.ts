// Next Imports
import type { MetadataRoute } from 'next'

// Lib Imports
import { indexable, siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

const sitemap = (): MetadataRoute.Sitemap => {
  if (!indexable()) return []

  const base = siteUrl()
  const lastModified = new Date()

  return [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/docs`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/register`, lastModified, changeFrequency: 'yearly', priority: 0.3 }
  ]
}

export default sitemap
