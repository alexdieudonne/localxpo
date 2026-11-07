// Third-party Imports
import { CheckCircle2Icon } from 'lucide-react'

// Component Imports
import DeleteCredentialButton from '@/views/credentials/delete-credential-button'

// Lib Imports
import { formatDateTime, timeAgo } from '@/lib/format'
import type { Credential } from '@/lib/server/credentials'

const SavedCredential = ({
  c,
  lines,
  warning,
  orgSlug,
  canDelete
}: {
  c: Credential
  lines: [string, string][]
  warning: string
  orgSlug: string
  canDelete: boolean
}) => (
  <div className='flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3'>
    <div className='flex min-w-0 gap-3'>
      <CheckCircle2Icon className='mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400' />
      <div className='min-w-0 text-sm'>
        <p className='truncate font-medium'>{c.label}</p>
        {lines.map(([k, v]) => (
          <p key={k} className='text-muted-foreground truncate'>
            {k}: <span className='font-mono text-xs'>{v}</span>
          </p>
        ))}
        <p className='text-muted-foreground text-xs' title={formatDateTime(c.updated_at)}>
          Updated {timeAgo(c.updated_at)}
        </p>
      </div>
    </div>
    {canDelete && <DeleteCredentialButton orgSlug={orgSlug} id={c.id} warning={warning} />}
  </div>
)

export default SavedCredential
