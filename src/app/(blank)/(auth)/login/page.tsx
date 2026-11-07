// Next Imports
import Link from 'next/link'
import { redirect } from 'next/navigation'

// Component Imports
import AuthCard from '@/views/auth/auth-card'
import LoginForm from '@/views/auth/login-form'

// Lib Imports
import { getCurrentUser } from '@/lib/server/auth'

export const metadata = { title: 'Sign in' }

const LoginPage = async ({ searchParams }: { searchParams: Promise<{ next?: string }> }) => {
  if (await getCurrentUser()) redirect('/')

  const { next } = await searchParams

  return (
    <AuthCard
      title='Welcome back'
      description='Sign in to follow your builds, machines and store uploads.'
    >
      <div className='space-y-6'>
        <LoginForm next={next} />
        <p className='text-muted-foreground text-sm'>
          New to localxpo?{' '}
          <Link href='/register' className='text-foreground font-medium underline-offset-4 hover:underline'>
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}

export default LoginPage
