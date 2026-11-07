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
import { cn } from '@/lib/utils'

// Style Imports
import './globals.css'
import ScrollToTop from '@/components/layout/ScrollToTop'

// Self-hosted Geist (no request to Google Fonts at build time).
const geistSans = GeistSans
const geistMono = GeistMono

export const metadata: Metadata = {
  title: { default: 'localxpo', template: '%s · localxpo' },
  description: 'Track Expo builds that run on your own machine: live logs, readable errors, store credentials made simple.',
  metadataBase: new URL(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}`)
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
