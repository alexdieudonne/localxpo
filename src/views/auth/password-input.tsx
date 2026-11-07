'use client'

// React Imports
import { useState } from 'react'
import type { ComponentProps } from 'react'

// Third-party Imports
import { EyeIcon, EyeOffIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

const PasswordInput = (props: Omit<ComponentProps<typeof InputGroupInput>, 'type'>) => {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup>
      <InputGroupInput type={visible ? 'text' : 'password'} placeholder='••••••••••••' {...props} />
      <InputGroupAddon align='inline-end' className='pr-1.5'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={() => setVisible(v => !v)}
          className='text-muted-foreground rounded-l-none hover:bg-transparent'
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
          <span className='sr-only'>{visible ? 'Hide password' : 'Show password'}</span>
        </Button>
      </InputGroupAddon>
    </InputGroup>
  )
}

export default PasswordInput
