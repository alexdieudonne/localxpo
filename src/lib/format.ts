export const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || ms < 0) return '—'

  const s = Math.round(ms / 1000)

  if (s < 60) return `${s}s`

  const m = Math.floor(s / 60)

  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export const buildDuration = (b: { started_at: number | null; finished_at: number | null; status: string }, now = Date.now()) =>
  b.started_at ? (b.finished_at ?? (b.status === 'in_progress' ? now : b.started_at)) - b.started_at : null

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export const timeAgo = (ts: number | null | undefined, now = Date.now()) => {
  if (!ts) return '—'

  const diff = (ts - now) / 1000
  const abs = Math.abs(diff)

  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')

  return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatDateTime = (ts: number | null | undefined) =>
  ts ? new Date(ts).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const shortSha = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : '—')

export const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android' }
