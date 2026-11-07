// Next Imports
import { headers } from 'next/headers'

/** Public URL of this server as the browser sees it (used in copy-paste CLI commands). */
export const getServerUrl = async () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')

  return `${proto}://${host}${process.env.BASEPATH ?? ''}`
}
