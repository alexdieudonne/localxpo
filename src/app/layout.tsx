// React Imports
import type { ReactNode } from 'react'

// Next Imports
import type { Metadata } from 'next'

// Third-party Imports
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Component Imports
import Providers from '@/components/Providers'
import { TooltipProvider } from '@/components/ui/tooltip'

// Util Imports
import { indexable, siteUrl } from '@/lib/site'
import { cn } from '@/lib/utils'

// Style Imports
import './globals.css'
import ScrollToTop from '@/components/layout/ScrollToTop'

// Self-hosted Geist (no request to Google Fonts at build time).
const geistSans = GeistSans
const geistMono = GeistMono

const SHARE_TITLE = 'localxpo: build Expo apps on your own Mac or PC'

const SHARE_DESCRIPTION =
  'Open-source alternative to cloud build services. Build, sign and submit iOS and Android Expo apps on your own machines with fastlane, and follow every build in one dashboard.'

export const metadata: Metadata = {
  title: { default: 'localxpo', template: '%s · localxpo' },
  description: 'Build, sign and submit Expo apps on your own Mac or PC, and follow every build of the team in one dashboard: live logs, errors explained, store submissions.',
  applicationName: 'localxpo',
  metadataBase: new URL(siteUrl()),

  // Only localxpo Cloud is meant for search engines; a self-hosted dashboard stays private.
  robots: indexable() ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { type: 'website', siteName: 'localxpo', locale: 'en_US', url: '/', title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: 'Local Expo builds with live logs, store submissions and a team dashboard. Open source, free for one machine.'
  }
}

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <html
      lang='en'
      className={cn(geistSans.variable, geistMono.variable, 'flex min-h-full w-full antialiased')}
      data-scroll-behavior='smooth'
      suppressHydrationWarning
    >
      <body className='flex min-h-full w-full flex-auto flex-col'>
        <NuqsAdapter>
          <Providers sidebarDefaultOpen={true}>
            <TooltipProvider>{children}</TooltipProvider>
          </Providers>
        </NuqsAdapter>

        <ScrollToTop />
      </body>
    </html>
  )
}

export default RootLayout
