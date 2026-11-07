// Component Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordForm, ProfileForm } from '@/views/settings/profile-forms'

// Lib Imports
import { formatDateTime } from '@/lib/format'
import { requireUser } from '@/lib/server/auth'

export const metadata = { title: 'Account' }

const SettingsPage = async () => {
  const user = await requireUser()

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
      </div>
    </div>
  )
}

export default SettingsPage
