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
  // Skip API routes (they authenticate themselves), Next internals and static files.
  matcher: ['/((?!api|_next/static|_next/image|images|favicon.ico).*)']
}
