// Component Imports
import { Skeleton } from '@/components/ui/skeleton'

/** Shown by loading.tsx while a page's server data loads (sidebar and header stay interactive). */
const PageSkeleton = ({ variant = 'list' }: { variant?: 'list' | 'grid' }) => (
  <div className='space-y-6' aria-busy='true' aria-label='Loading'>
    <div className='space-y-2'>
      <Skeleton className='h-7 w-52' />
      <Skeleton className='h-4 w-96 max-w-full' />
    </div>
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className='h-24 rounded-xl' />
      ))}
    </div>
    {variant === 'grid' ? (
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className='h-44 rounded-xl' />
        ))}
      </div>
    ) : (
      <div className='space-y-2 rounded-xl border p-4'>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className='h-9 w-full' />
        ))}
      </div>
    )}
  </div>
)

export default PageSkeleton
