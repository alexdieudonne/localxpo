'use client'

// React Imports
import { useEffect, useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'

// Third-party Imports
import { CheckIcon, ChevronsUpDownIcon, CopyIcon, PlusIcon, SearchIcon, SettingsIcon, SparklesIcon, TerminalIcon } from 'lucide-react'

// Component Imports
import LogoSvg from '@/assets/svg/logo'
import PlanBadge, { type PlanTier } from '@/components/shared/PlanBadge'
import { colorFor } from '@/components/shared/EntityAvatar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sidebar, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Config Imports
import { orgNav, orgNavCloud, projectNav, type NavSection } from '@/configs/navConfig'
import themeConfig from '@/configs/themeConfig'

// Lib Imports
import { formatHistory, PLANS, TRIAL_DAYS } from '@/lib/plans'

// Util Imports
import { cn } from '@/lib/utils'

export type SidebarOrg = {
  slug: string
  name: string
  role: string

  /** localxpo Cloud only: plan name, its id and whether it's a trial. */
  plan?: string | null
  tier?: PlanTier
  trial?: boolean
}
export type SidebarProject = { orgSlug: string; slug: string; name: string; identifier?: string | null; lastStatus?: string | null }

type Props = {
  orgs: SidebarOrg[]
  projects: SidebarProject[]
  fallbackOrg: string | null
  user: { name: string; email: string }

  /** localxpo Cloud: shows Billing and each organization's plan. */
  cloud?: boolean
}

export const ORG_COOKIE = 'lx_org'

const initials = (name: string, max = 2) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, max)
    .map(w => w[0]!.toUpperCase())
    .join('') || '?'

const STATUS_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  failed: 'bg-red-500',
  in_progress: 'bg-sky-500 animate-pulse',
  canceled: 'bg-amber-500'
}

// ---------- Rail: one tile per organization ----------

const RailTile = ({
  href,
  label,
  active,
  children,
  className,
  badge
}: {
  href: string
  label: string
  active?: boolean
  children: React.ReactNode
  className?: string
  badge?: React.ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold transition',
            'focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2',
            active ? 'rounded-[14px]' : 'opacity-80 hover:rounded-[14px] hover:opacity-100',
            className
          )}
        />
      }
    >
      {/* Active marker hugging the rail's left edge */}
      <span
        className={cn(
          'bg-foreground absolute top-1/2 -left-[11px] w-1 -translate-y-1/2 rounded-r-full transition-all',
          active ? 'h-6' : 'h-0'
        )}
        aria-hidden
      />
      {children}
      {badge}
    </TooltipTrigger>
    <TooltipContent side='right'>{label}</TooltipContent>
  </Tooltip>
)

// ---------- Project picker (searchable) ----------

const ProjectPicker = ({ orgBase, projects, current }: { orgBase: string; projects: SidebarProject[]; current?: SidebarProject }) => {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type='button'
            className='bg-background hover:border-foreground/20 flex w-full items-center gap-3 rounded-lg border p-2.5 text-left shadow-xs transition outline-none focus-visible:ring-2'
          />
        }
      >
        {current ? (
          <>
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold', colorFor(current.name))}>
              {initials(current.name, 1)}
            </span>
            <span className='min-w-0 flex-1'>
              <span className='flex items-center gap-1.5'>
                <span className='truncate text-sm font-semibold'>{current.name}</span>
                {current.lastStatus && <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[current.lastStatus])} />}
              </span>
              <span className='text-muted-foreground block truncate font-mono text-[11px]'>{current.identifier ?? current.slug}</span>
            </span>
          </>
        ) : (
          <>
            <span className='text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed'>
              <SearchIcon className='size-4' />
            </span>
            <span className='text-muted-foreground min-w-0 flex-1 truncate text-sm'>
              {projects.length ? 'Choose a project' : 'No projects yet'}
            </span>
          </>
        )}
        <ChevronsUpDownIcon className='text-muted-foreground size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-(--anchor-width) min-w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search projects…' />
          <CommandList>
            <CommandEmpty>
              {projects.length ? 'No match.' : (
                <span>
                  Run <code className='font-mono'>npx localxpo link</code> in an Expo app.
                </span>
              )}
            </CommandEmpty>
            {projects.length > 0 && (
              <CommandGroup>
                {projects.map(p => (
                  <CommandItem
                    key={p.slug}
                    value={`${p.name} ${p.slug} ${p.identifier ?? ''}`}
                    onSelect={() => {
                      setOpen(false)
                      router.push(`${orgBase}/projects/${p.slug}`)
                    }}
                  >
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold', colorFor(p.name))}>
                      {initials(p.name, 1)}
                    </span>
                    <span className='min-w-0 flex-1 truncate'>{p.name}</span>
                    {p.slug === current?.slug && <CheckIcon className='size-4' />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value='__all'
                onSelect={() => {
                  setOpen(false)
                  router.push(orgBase)
                }}
              >
                All projects
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ---------- Plan card (localxpo Cloud) ----------

const PlanCard = ({ org, orgBase }: { org: SidebarOrg; orgBase: string }) => {
  if (org.tier !== 'free' || org.role !== 'owner') return null

  return (
    <Link href={`${orgBase}/billing`} className='group hover:bg-sidebar-accent/60 block rounded-lg border p-3 transition'>
      <span className='flex items-center gap-1.5 text-xs font-medium'>
        <SparklesIcon className='text-primary size-3.5' aria-hidden /> Upgrade to Pro
      </span>
      <span className='text-muted-foreground mt-1 block text-[11px] leading-relaxed'>
        {PLANS.pro.limits.machines} machines, {formatHistory(PLANS.pro.limits.historyDays)} of history. Free for {TRIAL_DAYS} days.
      </span>
    </Link>
  )
}

// ---------- Copyable build command ----------

const QuickBuild = () => {
  const [copied, setCopied] = useState(false)
  const cmd = 'npx localxpo build -p android'

  return (
    <div className='bg-sidebar-accent/60 rounded-lg p-3'>
      <p className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
        <TerminalIcon className='size-3.5' /> Build from your terminal
      </p>
      <button
        type='button'
        onClick={async () => {
          await navigator.clipboard.writeText(cmd)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }}
        className='hover:text-foreground text-foreground/80 mt-1.5 flex w-full items-center justify-between gap-2 font-mono text-xs'
        title='Copy'
      >
        <span className='truncate'>
          <span className='text-muted-foreground'>$ </span>
          {cmd}
        </span>
        {copied ? <CheckIcon className='size-3.5 shrink-0' /> : <CopyIcon className='size-3.5 shrink-0' />}
      </button>
    </div>
  )
}

// ---------- Sidebar ----------

const AppSidebar = ({ orgs, projects, fallbackOrg, user, cloud = false }: Props) => {
  const params = useParams<{ org?: string; project?: string }>()
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const orgSlug = params.org ?? fallbackOrg ?? orgs[0]?.slug
  const org = orgs.find(o => o.slug === orgSlug) ?? orgs[0]
  const orgProjects = projects.filter(p => p.orgSlug === org?.slug)
  const project = params.project ? orgProjects.find(p => p.slug === decodeURIComponent(params.project!)) : undefined

  // The last project opened in this org, so the "Project" tab has somewhere to go.
  const [lastProject, setLastProject] = useState<string | null>(null)

  if (project && project.slug !== lastProject) setLastProject(project.slug)

  useEffect(() => {
    if (params.org) document.cookie = `${ORG_COOKIE}=${encodeURIComponent(params.org)}; path=/; max-age=31536000; samesite=lax`
  }, [params.org])

  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  const orgBase = org ? `/${org.slug}` : '/'
  const projectTarget = project ?? orgProjects.find(p => p.slug === lastProject) ?? orgProjects[0]
  const mode: 'org' | 'project' = project ? 'project' : 'org'
  const base = project ? `${orgBase}/projects/${project.slug}` : orgBase
  const sections: NavSection[] = project ? projectNav : cloud ? orgNavCloud : orgNav

  const isActive = (path: string, prefix?: boolean) => {
    const href = base + path

    return pathname === href || (prefix === true && pathname.startsWith(`${href}/`))
  }

  return (
    <Sidebar collapsible='offcanvas' variant='sidebar'>
      <div className='flex h-full min-h-0'>
        {/* ---------- Rail ---------- */}
        <nav aria-label='Organizations' className='bg-sidebar-accent/40 flex w-[60px] shrink-0 flex-col items-center gap-2 border-r py-3'>
          <Link href={orgBase} aria-label={themeConfig.templateName} className='mb-1'>
            <LogoSvg className='size-9' />
          </Link>
          <div className='bg-sidebar-border mb-1 h-px w-7' />
          <div className='flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-[10px] pt-0.5'>
            {orgs.map(o => (
              <RailTile
                key={o.slug}
                href={`/${o.slug}`}
                label={cloud && o.plan ? `${o.name} · ${o.plan}` : o.name}
                active={o.slug === org?.slug}
                className={colorFor(o.name)}
              >
                {initials(o.name)}
              </RailTile>
            ))}
            <RailTile
              href='/account/new-organization'
              label='New organization'
              active={pathname === '/account/new-organization'}
              className='text-muted-foreground hover:text-foreground border-2 border-dashed'
            >
              <PlusIcon className='size-4' />
            </RailTile>
          </div>
          <RailTile href='/account/tokens' label='CLI & tokens' active={pathname === '/account/tokens'} className='text-muted-foreground hover:bg-sidebar-accent'>
            <TerminalIcon className='size-4' />
          </RailTile>
          <RailTile href='/account' label={`${user.name} · Account`} active={pathname === '/account'} className='bg-foreground text-background rounded-full! text-xs'>
            {initials(user.name)}
          </RailTile>
        </nav>

        {/* ---------- Context panel ---------- */}
        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='space-y-3 px-3 pt-4 pb-3'>
            <div className='flex items-center justify-between gap-2 px-1'>
              <div className='min-w-0'>
                <div className='flex min-w-0 items-center gap-1.5'>
                  <p className='truncate text-[15px] font-semibold'>{org?.name ?? themeConfig.templateName}</p>
                  {org && cloud && org.plan && (
                    <Link href={`${orgBase}/billing`} className='shrink-0 transition hover:opacity-85' title={`${org.plan} plan`}>
                      <PlanBadge tier={org.tier ?? 'free'} label={org.plan} />
                    </Link>
                  )}
                </div>
                <p className='text-muted-foreground truncate text-xs'>
                  {org ? `/${org.slug} · ${org.role}` : themeConfig.tagline}
                </p>
              </div>
              {org && (
                <Link
                  href={`${orgBase}/settings`}
                  className='text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md p-1.5'
                  aria-label='Organization settings'
                >
                  <SettingsIcon className='size-4' />
                </Link>
              )}
            </div>

            {/* Organization / Project toggle */}
            <div className='bg-sidebar-accent grid grid-cols-2 rounded-lg p-0.5 text-[13px] font-medium' role='tablist'>
              <Link
                href={orgBase}
                role='tab'
                aria-selected={mode === 'org'}
                className={cn(
                  'rounded-md px-2 py-1.5 text-center transition',
                  mode === 'org' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Organization
              </Link>
              {projectTarget ? (
                <Link
                  href={`${orgBase}/projects/${projectTarget.slug}`}
                  role='tab'
                  aria-selected={mode === 'project'}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-center transition',
                    mode === 'project' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Project
                </Link>
              ) : (
                <span role='tab' aria-disabled className='text-muted-foreground/50 cursor-not-allowed rounded-md px-2 py-1.5 text-center'>
                  Project
                </span>
              )}
            </div>

            {mode === 'project' && <ProjectPicker orgBase={orgBase} projects={orgProjects} current={project} />}
          </div>

          <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pt-1 pb-4'>
            {sections.map(section => (
              <div key={section.label}>
                <p className='text-muted-foreground px-2.5 pb-1.5 text-xs font-medium'>{section.label}</p>
                <ul className='space-y-0.5'>
                  {section.items.map(item => {
                    const active = isActive(item.path, item.prefix)

                    return (
                      <li key={item.label}>
                        <Link
                          href={base + item.path}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition outline-none',
                            'focus-visible:ring-sidebar-ring focus-visible:ring-2 [&_svg]:size-4 [&_svg]:shrink-0',
                            active
                              ? 'bg-primary/[0.07] text-foreground font-medium before:bg-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full'
                              : 'text-foreground/75 hover:bg-sidebar-accent hover:text-foreground'
                          )}
                        >
                          <item.icon className={active ? 'text-primary' : 'text-muted-foreground'} />
                          <span className='truncate'>{item.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className='space-y-2 px-3 pb-3'>
            {org && cloud && org.plan && <PlanCard org={org} orgBase={orgBase} />}
            <QuickBuild />
          </div>
        </div>
      </div>
    </Sidebar>
  )
}

export default AppSidebar
