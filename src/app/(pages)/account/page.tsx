// Next Imports
import Link from 'next/link'

// Component Imports
import PlanBadge from '@/components/shared/PlanBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordForm, ProfileForm } from '@/views/settings/profile-forms'

// Lib Imports
import { formatDateTime } from '@/lib/format'
import { requireUser } from '@/lib/server/auth'
import { getOrgPlan, isCloud } from '@/lib/server/billing'
import { listOrgsForUser } from '@/lib/server/orgs'

export const metadata = { title: 'Account' }

const SettingsPage = async () => {
  const user = await requireUser()
  const cloud = isCloud()

  const orgs = cloud
    ? await Promise.all(
        (await listOrgsForUser(user.id)).map(async o => {
          const { plan, billing } = await getOrgPlan(o.id)

          return { slug: o.slug, name: o.name, role: o.role, plan, trial: billing.status === 'trialing' && plan.id !== 'free' }
        })
      )
    : []

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Account</h1>
        <p className='text-muted-foreground'>Member since {formatDateTime(user.created_at)}</p>
      </div>
      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} email={user.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Used for the dashboard and `npx localxpo link`.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
        {cloud && orgs.length > 0 && (
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle>Organizations and plans</CardTitle>
              <CardDescription>Each organization has its own plan. Owners manage it from Billing.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='divide-y'>
                {orgs.map(o => (
                  <li key={o.slug} className='flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0'>
                    <Link href={`/${o.slug}`} className='min-w-0 hover:underline'>
                      <span className='block truncate font-medium'>{o.name}</span>
                      <span className='text-muted-foreground block truncate text-xs'>
                        /{o.slug} · {o.role}
                      </span>
                    </Link>
                    <Link href={`/${o.slug}/billing`} className='shrink-0 transition hover:opacity-85'>
                      <PlanBadge tier={o.plan.id} label={o.plan.name} trial={o.trial} size='md' />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
