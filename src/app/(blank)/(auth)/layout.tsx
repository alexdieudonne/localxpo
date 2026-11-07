// React Imports
import type { ReactNode } from 'react'

// Component Imports
import AuthShell, { type AuthAside } from '@/views/auth/auth-shell'

// Lib Imports
import { PLANS } from '@/lib/plans'
import { isCloud } from '@/lib/server/billing'

/** /login and /register share this layout, so the panel can slide between them instead of reloading. */
const AuthLayout = ({ children }: { children: ReactNode }) => {
  const cloud = isCloud()
  const free = PLANS.free.limits

  const login: AuthAside = {
    heading: 'Your builds kept running while you were away.',
    terminal: [
      { text: '$ npx localxpo builds' },
      { text: '#48  android  production  shipped   5m 01s', tone: 'ok' },
      { text: '#47  ios      production  shipped   41s, reused #45', tone: 'ok' },
      { text: '#46  android  preview     failed    SDK location not found', tone: 'dim' }
    ],
    points: [
      'Live logs for builds running right now',
      'Every failure explained in plain words',
      'Machines, memory and store uploads in one place'
    ]
  }

  const register: AuthAside = {
    heading: 'One command from your first tracked build.',
    terminal: [
      { text: '$ npx localxpo link' },
      { text: '✓ Signed in, organization "Pebble"', tone: 'ok' },
      { text: '✓ Keystore and App Store key found in your Expo account', tone: 'ok' },
      { text: '$ npx localxpo build -p ios --submit' },
      { text: '› logs streaming to the dashboard…', tone: 'dim' }
    ],
    points: cloud
      ? [
          `Free plan: ${free.members} member, ${free.machines} machine, ${free.historyDays} days of history`,
          'No card needed; upgrade from Billing when the team grows',
          'Nothing to host: the dashboard runs on localxpo Cloud'
        ]
      : [
          'Every feature included, with no plan or limit',
          'Invite teammates once they have an account',
          'Data stays on this server'
        ]
  }

  return <AuthShell asides={{ login, register }}>{children}</AuthShell>
}

export default AuthLayout
