// Util Imports
import { cn } from '@/lib/utils'

// Stable color per name, so an org/project keeps its color everywhere.
const PALETTE = [
  'bg-amber-500 text-amber-950',
  'bg-sky-500 text-sky-950',
  'bg-emerald-500 text-emerald-950',
  'bg-violet-500 text-violet-50',
  'bg-rose-500 text-rose-50',
  'bg-orange-500 text-orange-950',
  'bg-teal-500 text-teal-950',
  'bg-indigo-500 text-indigo-50'
]

export const colorFor = (key: string) => {
  let h = 0

  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0

  return PALETTE[h % PALETTE.length]
}

const EntityAvatar = ({
  name,
  kind,
  className
}: {
  name: string
  kind: 'org' | 'project'
  className?: string
}) => (
  <span
    className={cn(
      'flex size-7 shrink-0 items-center justify-center text-[13px] font-semibold',
      kind === 'org' ? 'rounded-lg' : 'rounded-full',
      colorFor(name),
      className
    )}
    aria-hidden
  >
    {kind === 'org'
      ? name
          .split(/[\s._-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(w => w[0]!.toUpperCase())
          .join('')
      : (name.trim()[0] ?? '?').toUpperCase()}
  </span>
)

export default EntityAvatar
