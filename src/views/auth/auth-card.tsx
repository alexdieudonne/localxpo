// React Imports
import type { ReactNode } from 'react'

/**
 * Title, description and form of a sign-in / sign-up page. The frame around it (logo, sliding dark panel) is
 * AuthShell, in the (auth) layout. Each page fades in as the panel moves aside.
 */
const AuthCard = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <div className='animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-200 duration-500 motion-reduce:animate-none'>
    <h1 className='text-3xl font-semibold tracking-tight text-balance'>{title}</h1>
    <p className='text-muted-foreground mt-2 text-pretty'>{description}</p>
    <div className='mt-8'>{children}</div>
  </div>
)

export default AuthCard
