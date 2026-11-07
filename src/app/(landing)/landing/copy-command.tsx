'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { CheckIcon, CopyIcon } from 'lucide-react'

import s from './landing.module.css'

const CopyCommand = ({ command }: { command: string }) => {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type='button'
      className={`${s.copy} ${s.mono}`}
      aria-label={`Copy ${command}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          /* clipboard blocked: the command stays visible to copy by hand */
        }
      }}
    >
      <span>
        <span style={{ color: 'var(--slate)' }}>$ </span>
        {command}
      </span>
      {copied ? <CheckIcon className='size-4' style={{ color: 'var(--ok)' }} /> : <CopyIcon className='size-4' style={{ color: 'var(--slate)' }} />}
    </button>
  )
}

export default CopyCommand
