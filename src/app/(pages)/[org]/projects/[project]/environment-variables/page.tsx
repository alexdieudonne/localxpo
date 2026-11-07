// Third-party Imports
import { LockIcon } from 'lucide-react'

// Component Imports
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeleteEnvVarButton, EnvVarForm } from '@/views/env/env-var-forms'

// Lib Imports
import { timeAgo } from '@/lib/format'
import { ENVIRONMENTS, listEnvVars } from '@/lib/server/env-vars'
import { requireProject, type ProjectParams } from '@/lib/server/scope'

export const metadata = { title: 'Environment variables' }
export const dynamic = 'force-dynamic'

const EnvVarsPage = async ({ params }: { params: ProjectParams }) => {
  const p = await params
  const { org, project } = await requireProject(p.org, p.project)
  const vars = await listEnvVars(project.id)
  const byName = new Map<string, typeof vars>()

  for (const v of vars) byName.set(v.name, [...(byName.get(v.name) ?? []), v])

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Environment variables'
        description={
          <>
            Injected into the build on whichever machine runs it, so <code className='font-mono'>.env</code> files don’t need to be copied
            around. The environment follows the eas.json profile: <code className='font-mono'>environment</code> if set, otherwise
            development / preview / production by profile name. Values are encrypted; secrets are hidden here and in logs.
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Add or update a variable</CardTitle>
          <CardDescription>
            Use the <code className='font-mono'>EXPO_PUBLIC_</code> prefix for values your JavaScript reads at runtime: those end up inside the app
            bundle, so anyone with the app can read them. Keep real secrets (API tokens, signing passwords) without that prefix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnvVarForm orgSlug={org.slug} projectId={project.id} />
        </CardContent>
      </Card>

      <Card className='gap-0 py-0'>
        {vars.length === 0 ? (
          <p className='text-muted-foreground p-10 text-center text-sm'>No variables yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {ENVIRONMENTS.map(e => (
                  <TableHead key={e} className='capitalize'>
                    {e}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...byName.entries()].map(([name, rows]) => (
                <TableRow key={name}>
                  <TableCell className='align-top'>
                    <div className='flex items-center gap-2 font-mono text-sm font-medium'>
                      {name}
                      {rows.some(r => r.secret) && (
                        <Badge variant='secondary' className='gap-1 font-sans'>
                          <LockIcon className='size-3' /> secret
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {ENVIRONMENTS.map(env => {
                    const v = rows.find(r => r.environment === env)

                    return (
                      <TableCell key={env} className='max-w-56 align-top'>
                        {v ? (
                          <div className='flex items-start justify-between gap-2'>
                            <div className='min-w-0'>
                              <p className='truncate font-mono text-xs' title={v.secret ? undefined : (v.value ?? undefined)}>
                                {v.preview}
                              </p>
                              <p className='text-muted-foreground text-[11px]'>{timeAgo(v.updated_at)}</p>
                            </div>
                            <DeleteEnvVarButton orgSlug={org.slug} projectId={project.id} id={v.id} label={`${name} (${env})`} />
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-xs'>—</span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

export default EnvVarsPage
