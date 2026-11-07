'use client'

// React Imports
import { Fragment } from 'react'

// Next Imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Third-party Imports
import { SparklesIcon } from 'lucide-react'

// Component Imports
import ModeToggle from '@/components/layout/ModeToggle'
import PlanBadge, { isPaidTier } from '@/components/shared/PlanBadge'
import type { SidebarOrg, SidebarProject } from '@/components/layout/AppSidebar'
import ProfileDropdown, { type HeaderUser } from '@/components/shared/ProfileDropdown'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const LABELS: Record<string, string> = {
  account: 'Account',
  tokens: 'CLI & tokens',
  'new-organization': 'New organization',
  'environment-variables': 'Environment variables',
  'development-builds': 'Development builds'
}

type Crumb = { label: string; href: string }

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** /acme/projects/app/builds/abc → acme › app › Builds › #abc (the "projects" segment is implied). */
const toCrumbs = (pathname: string, orgs: SidebarOrg[], projects: SidebarProject[]): Crumb[] => {
  const seg = pathname.split('/').filter(Boolean)

  if (seg.length === 0) return []
  if (seg[0] === 'account') return seg.map((s, i) => ({ label: LABELS[s] ?? titleCase(s), href: '/' + seg.slice(0, i + 1).join('/') }))

  const org = orgs.find(o => o.slug === seg[0])
  const crumbs: Crumb[] = [{ label: org?.name ?? seg[0], href: `/${seg[0]}` }]
  let i = 1

  if (seg[1] === 'projects' && seg[2]) {
    const slug = decodeURIComponent(seg[2])

    crumbs.push({ label: projects.find(p => p.orgSlug === seg[0] && p.slug === slug)?.name ?? slug, href: `/${seg[0]}/projects/${seg[2]}` })
    i = 3
  }

  for (; i < seg.length; i++) {
    const s = seg[i]

    crumbs.push({
      label: LABELS[s] ?? (s.length > 14 ? `#${s.slice(0, 7)}` : titleCase(s)),
      href: '/' + seg.slice(0, i + 1).join('/')
    })
  }

  return crumbs
}

type HeaderProps = { user: HeaderUser; orgs: SidebarOrg[]; projects: SidebarProject[]; fallbackOrg?: string | null }

const Header = ({ user, orgs, projects, fallbackOrg }: HeaderProps) => {
  const pathname = usePathname()
  const crumbs = toCrumbs(pathname, orgs, projects)
  const first = pathname.split('/').filter(Boolean)[0]
  const org = orgs.find(o => o.slug === first) ?? orgs.find(o => o.slug === fallbackOrg)
  const paid = isPaidTier(org?.tier)

  return (
    <header className='bg-card sticky top-0 z-50 border-b'>
      <div className='mx-auto flex max-w-360 items-center justify-between gap-6 px-4 py-2 sm:px-6'>
        <div className='flex min-w-0 items-center gap-4'>
          <SidebarTrigger className='[&_svg]:size-5!' />
          <Separator orientation='vertical' className='hidden h-4! data-vertical:self-center sm:block' />
          <Breadcrumb className='hidden min-w-0 sm:block'>
            <BreadcrumbList>
              {crumbs.map((c, index) => {
                const isLast = index === crumbs.length - 1

                return (
                  <Fragment key={c.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className='max-w-48 truncate'>{c.label}</BreadcrumbPage>
                      ) : (
                        <Link href={c.href} className='hover:text-foreground max-w-48 truncate transition-colors'>
                          {c.label}
                        </Link>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className='flex items-center gap-1.5'>
          {org?.plan &&
            (paid ? (
              <Link href={`/${org.slug}/billing`} className='mr-1 transition hover:opacity-85' title={`${org.name} is on ${org.plan}`}>
                <PlanBadge tier={org.tier!} label={org.plan} trial={org.trial} size='md' />
              </Link>
            ) : (
              org.role === 'owner' && (
                <Link
                  href={`/${org.slug}/billing`}
                  className='text-muted-foreground hover:text-foreground mr-1 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition'
                >
                  <SparklesIcon className='text-primary size-3.5' aria-hidden />
                  Upgrade
                </Link>
              )
            ))}
          <ModeToggle />
          <ProfileDropdown user={user} plan={org?.plan ? { tier: org.tier ?? 'free', label: org.plan, trial: org.trial, orgName: org.name, href: `/${org.slug}/billing` } : undefined} />
        </div>
      </div>
    </header>
  )
}

export default Header
