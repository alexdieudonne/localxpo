import type { NextConfig } from 'next'

const dev = process.env.NODE_ENV !== 'production'

// Next needs inline scripts for hydration; everything else is same-origin. Stripe Checkout and the Customer
// Portal are full-page navigations, so they need no exception here.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }])
]

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH ?? '',
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],

  // Database drivers load from node_modules at runtime instead of being bundled: PGlite ships WebAssembly and
  // data files, pg has optional native bindings, better-sqlite3 (used once, to import old data) is native.
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'better-sqlite3', 'stripe'],

  headers: async () => [{ source: '/:path*', headers: securityHeaders }]
}

export default nextConfig
