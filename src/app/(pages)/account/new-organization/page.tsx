// Component Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import NewOrgForm from '@/views/orgs/new-org-form'

export const metadata = { title: 'New organization' }

const NewOrganizationPage = () => (
  <div className='mx-auto max-w-xl space-y-6'>
    <Card>
      <CardHeader>
        <CardTitle className='text-xl'>New organization</CardTitle>
        <CardDescription>
          Share projects, builds and store credentials with your team. Everyone keeps their own login and API tokens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewOrgForm />
      </CardContent>
    </Card>
  </div>
)

export default NewOrganizationPage
