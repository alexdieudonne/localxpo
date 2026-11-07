// Component Imports
import { Alert, AlertDescription } from '@/components/ui/alert'

// Type Imports
import type { FormState } from '@/lib/actions/auth'

const FormMessage = ({ state }: { state: FormState }) => {
  if (state.error)
    return (
      <Alert variant='destructive'>
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )

  if (state.success)
    return (
      <Alert className='border-emerald-500/30 bg-emerald-500/5'>
        <AlertDescription className='text-emerald-700 dark:text-emerald-300'>{state.success}</AlertDescription>
      </Alert>
    )

  return null
}

export default FormMessage
