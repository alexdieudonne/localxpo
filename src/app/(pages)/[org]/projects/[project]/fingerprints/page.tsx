// Next Imports
import Link from 'next/link'

// Third-party Imports
import { FingerprintIcon } from 'lucide-react'

// Component Imports
import { PlatformBadge } from '@/components/builds/badges'
import CodeBlock from '@/components/shared/CodeBlock'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { listFingerprints } from '@/lib/server/builds'
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Fingerprints' }
export const dynamic = 'force-dynamic'

const FingerprintsPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { project, base } = await requireProject(p.org, p.project)
  const rows = await listFingerprints(project.id)

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Fingerprints'
        description={
          <>
            A fingerprint is a hash of everything native in your app: native dependencies, config plugins, app.json fields that end up in
            Xcode/Gradle. Same fingerprint means an existing build can run your new JavaScript, so there’s nothing to rebuild. The CLI computes
            it with <code className='font-mono'>@expo/fingerprint</code> and tells you when a matching build already exists.
          </>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <FingerprintIcon className='text-muted-foreground size-10' />
            <p className='font-medium'>No fingerprints yet</p>
            <p className='text-muted-foreground max-w-md text-sm'>
              They are recorded with each build. For older SDKs, install the tool in your project:
            </p>
            <CodeBlock code='npx expo install @expo/fingerprint' className='w-full max-w-sm text-left' />
          </CardContent>
        </Card>
      ) : (
        <Card className='gap-0 py-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fingerprint</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className='max-md:hidden'>App version</TableHead>
                <TableHead className='text-right'>Builds</TableHead>
                <TableHead className='max-md:hidden'>First seen</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Reusable build</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.fingerprint}-${r.platform}`} id={r.fingerprint}>
                  <TableCell>
                    <span className='font-mono text-xs' title={r.fingerprint}>
                      {r.fingerprint.slice(0, 12)}
                    </span>
                    {i === 0 && <span className='bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium'>latest</span>}
                  </TableCell>
                  <TableCell>
                    <PlatformBadge platform={r.platform} />
                  </TableCell>
                  <TableCell className='font-mono text-xs max-md:hidden'>{r.app_version ?? '—'}</TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {r.successful}/{r.builds}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm max-md:hidden'>{timeAgo(r.first_seen)}</TableCell>
                  <TableCell className='text-muted-foreground text-sm'>{timeAgo(r.last_seen)}</TableCell>
                  <TableCell>
                    {r.latest_success_id ? (
                      <Link href={`${base}/builds/${r.latest_success_id}`} className='text-sm font-medium hover:underline'>
                        Open build →
                      </Link>
                    ) : (
                      <span className='text-muted-foreground text-sm'>none succeeded</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export default FingerprintsPage
