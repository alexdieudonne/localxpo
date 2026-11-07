// Third-party Imports
import {
  BanIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  Loader2Icon,
  SkipForwardIcon,
  XCircleIcon
} from 'lucide-react'

// Util Imports
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, { label: string; className: string; Icon: typeof CheckCircle2Icon; spin?: boolean }> = {
  queued: { label: 'Queued', className: 'bg-muted text-muted-foreground', Icon: CircleDashedIcon },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground', Icon: CircleDashedIcon },
  in_progress: {
    label: 'Building',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    Icon: Loader2Icon,
    spin: true
  },
  success: {
    label: 'Succeeded',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Icon: CheckCircle2Icon
  },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive', Icon: XCircleIcon },
  canceled: { label: 'Canceled', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', Icon: BanIcon },
  skipped: { label: 'Skipped', className: 'bg-muted text-muted-foreground', Icon: SkipForwardIcon },
  stale: { label: 'No signal', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', Icon: CircleDotIcon }
}

export const StatusIcon = ({ status, className }: { status: string; className?: string }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.queued

  return (
    <s.Icon
      className={cn(
        'size-4 shrink-0',
        s.spin && 'animate-spin',
        status === 'success' && 'text-emerald-600 dark:text-emerald-400',
        status === 'failed' && 'text-destructive',
        status === 'in_progress' && 'text-sky-600 dark:text-sky-400',
        (status === 'canceled' || status === 'stale') && 'text-amber-600 dark:text-amber-400',
        (status === 'pending' || status === 'queued' || status === 'skipped') && 'text-muted-foreground',
        className
      )}
      aria-hidden
    />
  )
}

export const StatusBadge = ({ status, className, kind = 'build' }: { status: string; className?: string; kind?: 'build' | 'submission' }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.queued
  const label = kind === 'submission' && status === 'in_progress' ? 'Uploading' : s.label

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        s.className,
        className
      )}
    >
      <s.Icon className={cn('size-3.5', s.spin && 'animate-spin')} aria-hidden />
      {label}
    </span>
  )
}

// Simple, original platform glyphs (not brand logos).
const AppleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox='0 0 16 16' className={className} aria-hidden fill='currentColor'>
    <rect x='3.5' y='1' width='9' height='14' rx='2' fillOpacity='0.18' />
    <rect x='3.5' y='1' width='9' height='14' rx='2' fill='none' stroke='currentColor' strokeWidth='1.3' />
    <circle cx='8' cy='12.6' r='0.9' />
  </svg>
)

const AndroidGlyph = ({ className }: { className?: string }) => (
  <svg viewBox='0 0 16 16' className={className} aria-hidden fill='currentColor'>
    <path d='M3 8a5 5 0 0 1 10 0v5.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5V8Z' fillOpacity='0.18' />
    <path
      d='M3 8a5 5 0 0 1 10 0v5.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5V8Z'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.3'
    />
    <circle cx='6' cy='7.5' r='0.9' />
    <circle cx='10' cy='7.5' r='0.9' />
  </svg>
)

export const PlatformBadge = ({ platform, className }: { platform: string; className?: string }) => (
  <span
    className={cn(
      'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap',
      className
    )}
  >
    {platform === 'ios' ? <AppleGlyph className='size-3.5' /> : <AndroidGlyph className='size-3.5' />}
    {platform === 'ios' ? 'iOS' : 'Android'}
  </span>
)
