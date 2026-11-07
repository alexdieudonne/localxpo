'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

/** Re-renders the server components around the page once (the layout keeps data from before a change made while rendering). */
const RefreshOnMount = () => {
  const router = useRouter()

  useEffect(() => {
    router.refresh()
  }, [router])

  return null
}

export default RefreshOnMount
