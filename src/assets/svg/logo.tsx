// React Imports
import type { SVGAttributes } from 'react'

/** localxpo mark: a local "L" bracket with an arrow leaving it (built here, shipped out). */
const Logo = (props: SVGAttributes<SVGElement>) => {
  return (
    <svg width='1em' height='1em' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <rect width='32' height='32' rx='10' className='fill-primary' />
      <path d='M10 9v13h8' className='stroke-primary-foreground' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M15.5 16.5 23 9m0 0h-5.5M23 9v5.5' className='stroke-primary-foreground' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round' opacity='0.7' />
    </svg>
  )
}

export default Logo
