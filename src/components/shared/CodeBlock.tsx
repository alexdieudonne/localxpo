'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { CheckIcon, CopyIcon } from 'lucide-react'

// Util Imports
import { cn } from '@/lib/utils'

const CodeBlock = ({ code, className }: { code: string; className?: string }) => {
  const [copied, setCopied] = useState(false)

  return (
    <div className={cn('group bg-muted/60 relative rounded-lg border', className)}>
      <pre className='overflow-x-auto p-3 pr-11 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap'>
        <code>{code}</code>
      </pre>
      <button
        type='button'
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className='text-muted-foreground hover:text-foreground bg-muted hover:bg-background absolute top-2 right-2 rounded-md p-1.5 transition'
        aria-label='Copy to clipboard'
      >
        {copied ? <CheckIcon className='size-4' /> : <CopyIcon className='size-4' />}
      </button>
    </div>
  )
}

export default CodeBlock
