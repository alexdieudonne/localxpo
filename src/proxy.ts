// Next Imports
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'lx_session'
const PUBLIC_PATHS = ['/login', '/register', '/pricing', '/landing', '/docs']

/** The product landing page (src/app/(landing)) is the home page for visitors without a session. LOCALXPO_LANDING=0 shows the sign-in form instead. */
const hasLanding = () => process.env.LOCALXPO_LANDING !== '0'

/**
 * Cheap gate: redirect visitors without a session cookie to /login.
 * The real check (cookie -> valid session in the DB) happens in the (pages) layout and in API routes.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // One address for the home page: visitors who open /landing directly are sent to / (permanent, for search engines).
  // The rewrite below targets /landing internally and does not run the proxy again.
  if (pathname === '/landing' && !req.cookies.has(SESSION_COOKIE) && hasLanding()) {
    const url = req.nextUrl.clone()

    url.pathname = '/'

    return NextResponse.redirect(url, 308)
  }

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next()

  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone()

    // Visitors get the landing page at `/` itself (rewrite, so the address stays /).
    if (pathname === '/' && hasLanding()) {
      url.pathname = '/landing'

      return NextResponse.rewrite(url)
    }

    url.pathname = '/login'
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`

    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Skip API routes (they authenticate themselves), Next internals, static files and the files search engines and
  // browsers fetch without a session (robots, sitemap, icons, manifest, social preview images).
  matcher: [
    '/((?!api|_next/static|_next/image|images|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|twitter-image|icon|apple-icon).*)'
  ]
}
