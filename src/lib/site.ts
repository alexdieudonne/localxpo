/** Public address of this dashboard: canonical URLs, sitemap, social previews. localxpo Cloud is localxpo.app. */
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || (process.env.LOCALXPO_MODE === 'cloud' ? 'https://localxpo.app' : 'http://localhost:3000')).replace(/\/$/, '')

/** Only the official Cloud site asks to be indexed; a self-hosted dashboard stays out of search engines. */
export const indexable = () => process.env.LOCALXPO_MODE === 'cloud'

export const REPO_URL = 'https://github.com/alexdieudonne/localxpo'

/** Social preview image (src/app/opengraph-image.png). Pages with their own `openGraph` must list it again: Next.js replaces nested fields. */
export const OG_IMAGES = [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'localxpo: build Expo apps on your own Mac or PC, with live logs and one dashboard for the team' }]
