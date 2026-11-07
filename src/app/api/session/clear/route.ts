// Next Imports
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Lib Imports
import { SESSION_COOKIE } from '@/lib/server/auth'

/** Removes an expired session cookie, then sends the visitor to the home page (landing page or sign-in). */
export const GET = async (req: Request) => {
  ;(await cookies()).delete(SESSION_COOKIE)

  return NextResponse.redirect(new URL('/', req.url))
}
