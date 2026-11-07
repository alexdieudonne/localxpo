// Next Imports
import type { MetadataRoute } from 'next'

const manifest = (): MetadataRoute.Manifest => ({
  name: 'localxpo',
  short_name: 'localxpo',
  description: 'Build, sign and submit Expo apps on your own machines, and follow every build in one dashboard.',
  start_url: '/',
  display: 'standalone',
  background_color: '#f7f5f2',
  theme_color: '#16181c',
  icons: [
    { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png' }
  ]
})

export default manifest
