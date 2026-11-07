// Next Imports
import Link from 'next/link'
import { redirect } from 'next/navigation'

// Component Imports
import AuthCard from '@/views/auth/auth-card'
import RegisterForm from '@/views/auth/register-form'

// Lib Imports
import { getCurrentUser } from '@/lib/server/auth'
import { isCloud } from '@/lib/server/billing'

export const metadata = { title: 'Create account' }

const RegisterPage = async () => {
  if (await getCurrentUser()) redirect('/')

  const cloud = isCloud()

  return (
    <AuthCard
      title='Create your account'
      description={cloud ? 'Start free on localxpo Cloud. Your builds still run on your own machines.' : 'One account on this server for you and your team.'}
    >
      <div className='space-y-6'>
        <RegisterForm />
        <p className='text-muted-foreground text-sm'>
          Already have an account?{' '}
          <Link href='/login' className='text-foreground font-medium underline-offset-4 hover:underline'>
            Sign in
          </Link>
          {cloud && (
            <>
              {' '}
              or{' '}
              <Link href='/pricing' className='text-foreground font-medium underline-offset-4 hover:underline'>
                see the plans
              </Link>
            </>
          )}
        </p>
      </div>
    </AuthCard>
  )
}

export default RegisterPage
