// Component Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import GettingStarted from '@/views/dashboard/getting-started'
import { CreateTokenForm, RevokeTokenButton } from '@/views/settings/token-forms'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { listApiTokens, requireUser } from '@/lib/server/auth'
import { getServerUrl } from '@/lib/server/request-url'

export const metadata = { title: 'CLI & tokens' }
export const dynamic = 'force-dynamic'

const TokensPage = async () => {
  const user = await requireUser()
  const tokens = await listApiTokens(user.id)
  const serverUrl = await getServerUrl()

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>CLI & tokens</h1>
        <p className='text-muted-foreground'>Each machine that builds gets its own token. Revoke one without touching the others.</p>
      </div>

      <GettingStarted serverUrl={serverUrl} />

      <Card className='gap-0 pb-0'>
        <CardHeader className='pb-4'>
          <CardTitle>API tokens</CardTitle>
          <CardDescription>
            <code className='font-mono'>npx localxpo link</code> creates one automatically. Create one by hand for CI or
            machines where you can’t type a password.
          </CardDescription>
        </CardHeader>
        <CardContent className='pb-4'>
          <CreateTokenForm serverUrl={serverUrl} />
        </CardContent>
        {tokens.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map(t => (
                <TableRow key={t.id}>
                  <TableCell className='font-medium'>{t.name}</TableCell>
                  <TableCell className='text-muted-foreground font-mono text-xs'>{t.prefix}…</TableCell>
                  <TableCell className='text-muted-foreground text-sm'>{t.last_used_at ? timeAgo(t.last_used_at) : 'never'}</TableCell>
                  <TableCell className='text-muted-foreground text-sm'>{timeAgo(t.created_at)}</TableCell>
                  <TableCell className='text-right'>
                    <RevokeTokenButton id={t.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

export default TokensPage
