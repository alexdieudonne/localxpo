// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

// Component Imports
import BuildsTable from '@/components/builds/builds-table'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Lib Imports
import { listBuilds, type BuildFilters } from '@/lib/server/builds'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

export type BuildsSearch = { status?: string; platform?: string; project?: string; page?: string }

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'in_progress', label: 'Building' },
  { value: 'success', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' }
]

const PLATFORM_FILTERS = [
  { value: '', label: 'All platforms' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' }
]

const Chip = ({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) => (
  <Link
    href={href}
    className={cn(
      'rounded-full border px-3 py-1 text-sm transition',
      active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted text-muted-foreground'
    )}
  >
    {children}
  </Link>
)

type Props = {
  orgId: string
  basePath: string
  search: BuildsSearch
  fixed?: Pick<BuildFilters, 'projectId' | 'devClient'>
  projects?: { id: string; name: string }[]
  showProject?: boolean
  empty: React.ReactNode
}

/** Filter chips + table + pagination, driven by the URL (?status=&platform=&project=&page=). */
const BuildsList = async ({ orgId, basePath, search, fixed = {}, projects, showProject = true, empty }: Props) => {
  const page = Math.max(Number(search.page) || 1, 1)

  const { rows, total } = await listBuilds(orgId, {
    ...fixed,
    projectId: fixed.projectId ?? search.project,
    status: search.status,
    platform: search.platform,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  })

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const filtered = Boolean(search.status || search.platform || search.project)

  const hrefWith = (patch: Partial<BuildsSearch>) => {
    const params = new URLSearchParams()

    for (const [k, v] of Object.entries({ ...search, page: undefined, ...patch })) if (v) params.set(k, v)
    const qs = params.toString()

    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap gap-2'>
          {STATUS_FILTERS.map(f => (
            <Chip key={f.label} active={(search.status ?? '') === f.value} href={hrefWith({ status: f.value })}>
              {f.label}
            </Chip>
          ))}
          <span className='bg-border mx-1 w-px self-stretch' />
          {PLATFORM_FILTERS.map(f => (
            <Chip key={f.label} active={(search.platform ?? '') === f.value} href={hrefWith({ platform: f.value })}>
              {f.label}
            </Chip>
          ))}
        </div>
        {projects && projects.length > 1 && (
          <div className='flex flex-wrap gap-2'>
            <Chip active={!search.project} href={hrefWith({ project: '' })}>
              All projects
            </Chip>
            {projects.map(p => (
              <Chip key={p.id} active={search.project === p.id} href={hrefWith({ project: p.id })}>
                {p.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Card className='gap-0 py-0'>
        {rows.length ? (
          <BuildsTable builds={rows} showProject={showProject} />
        ) : (
          <div className='text-muted-foreground p-10 text-center text-sm'>{filtered ? 'No builds match these filters.' : empty}</div>
        )}
      </Card>

      {pages > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-sm'>
            Page {page} of {pages} · {total} builds
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              render={page > 1 ? <Link href={hrefWith({ page: String(page - 1) })} /> : undefined}
              nativeButton={page <= 1}
            >
              <ChevronLeftIcon /> Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= pages}
              render={page < pages ? <Link href={hrefWith({ page: String(page + 1) })} /> : undefined}
              nativeButton={page >= pages}
            >
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuildsList
