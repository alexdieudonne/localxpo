// React Imports
import Link from 'next/link'

// Component Imports
import { Button } from '@/components/ui/button'

// SVG Imports
import Icon404 from '@/assets/svg/404'

const NotFound = () => {
  return (
    <div className='flex h-screen w-screen flex-col items-center justify-center gap-9 p-6'>
      <Icon404 className='h-auto w-full sm:h-120 sm:w-146' />
      <div className='flex flex-col items-center gap-4 text-center'>
        <h1 className='text-2xl font-semibold sm:text-3xl'>Page not found</h1>
        <p className='text-muted-foreground text-lg sm:text-xl'>We couldn&apos;t find the page you are looking for.</p>
        <div className='flex flex-wrap justify-center gap-2'>
          <Button className='rounded-full' render={<Link href='/' />} nativeButton={false}>
            Go back to home
          </Button>
          <Button variant='outline' className='rounded-full' render={<Link href='/docs' />} nativeButton={false}>
            Read the docs
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
