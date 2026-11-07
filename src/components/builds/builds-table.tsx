// Next Imports
import Link from 'next/link'

// Third-party Imports
import { GitBranchIcon, MonitorIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge, StatusBadge } from '@/components/builds/badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Lib Imports
import { buildDuration, formatDuration, shortSha, timeAgo } from '@/lib/format'
import { buildPath, STALE_AFTER_MS, type BuildRow } from '@/lib/server/builds'

const getNow = () => Date.now()

export const displayStatus = (b: Pick<BuildRow, 'status' | 'started_at'>, lastActivity?: number) =>
  b.status === 'in_progress' && Date.now() - (lastActivity ?? b.started_at ?? 0) > STALE_AFTER_MS ? 'stale' : b.status

type Props = { builds: BuildRow[]; showProject?: boolean; now?: number }

// Server component: `now` is captured once per request so every row agrees on the time.
const BuildsTable = ({ builds, showProject = true, now = getNow() }: Props) => {

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='w-[140px]'>Status</TableHead>
          {showProject && <TableHead>Project</TableHead>}
          <TableHead>Platform</TableHead>
          <TableHead className='max-md:hidden'>Profile</TableHead>
          <TableHead className='max-lg:hidden'>Source</TableHead>
          <TableHead className='max-lg:hidden'>Machine</TableHead>
          <TableHead className='text-right'>Duration</TableHead>
          <TableHead className='text-right'>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {builds.map(b => (
          <TableRow key={b.id} className='group relative cursor-pointer'>
            <TableCell>
              {/* Whole-row link: the anchor covers the row, other cells stay selectable text. */}
              <Link href={buildPath(b)} className='absolute inset-0' aria-label={`Open build #${b.number} of ${b.project_name}`} />
              <StatusBadge status={displayStatus(b)} />
            </TableCell>
            {showProject && (
              <TableCell>
                <div className='flex flex-col'>
                  <span className='font-medium group-hover:underline'>{b.project_name}</span>
                  <span className='text-muted-foreground text-xs'>#{b.number}</span>
                </div>
              </TableCell>
            )}
            <TableCell>
              <div className='flex items-center gap-2'>
                <PlatformBadge platform={b.platform} />
                {!showProject && <span className='text-muted-foreground text-xs'>#{b.number}</span>}
              </div>
            </TableCell>
            <TableCell className='max-md:hidden'>
              <span className='font-mono text-xs'>{b.profile}</span>
            </TableCell>
            <TableCell className='max-lg:hidden'>
              {b.git_branch || b.git_commit ? (
                <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
                  <GitBranchIcon className='size-3.5' />
                  <span className='max-w-32 truncate'>{b.git_branch ?? 'detached'}</span>
                  <span className='font-mono'>{shortSha(b.git_commit)}</span>
                  {b.git_dirty ? <span title='Uncommitted changes'>*</span> : null}
                </span>
              ) : (
                <span className='text-muted-foreground text-xs'>—</span>
              )}
            </TableCell>
            <TableCell className='max-lg:hidden'>
              <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
                <MonitorIcon className='size-3.5' />
                <span className='max-w-36 truncate'>{b.machine ?? 'unknown'}</span>
              </span>
            </TableCell>
            <TableCell className='text-right font-mono text-xs tabular-nums'>{formatDuration(buildDuration(b, now))}</TableCell>
            <TableCell className='text-muted-foreground text-right text-xs whitespace-nowrap'>{timeAgo(b.created_at, now)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default BuildsTable
