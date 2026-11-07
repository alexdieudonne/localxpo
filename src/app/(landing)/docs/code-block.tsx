'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { CheckIcon, CopyIcon } from 'lucide-react'

import d from './docs.module.css'

/** A shell or code sample. Lines starting with # are comments; the copy button skips them and the `$ ` prompt. */
const CodeBlock = ({ code, title, lang = 'bash' }: { code: string; title?: string; lang?: 'bash' | 'http' | 'json' }) => {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/^\n|\n$/g, '').split('\n')

  const copy = async () => {
    const text = lang === 'bash' ? lines.filter(l => !l.trim().startsWith('#')).map(l => l.replace(/\s+#.*$/, '')).join('\n') : lines.join('\n')

    try {
      await navigator.clipboard.writeText(text.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }

  return (
    <figure className={d.code}>
      <figcaption className={d.codeBar}>
        <span>{title ?? (lang === 'bash' ? 'Terminal' : lang.toUpperCase())}</span>
        <button type='button' onClick={copy} className={d.copy} aria-label='Copy code'>
          {copied ? <CheckIcon className='size-3.5' /> : <CopyIcon className='size-3.5' />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre>
        {lines.map((l, i) => {
          const comment = l.indexOf('#') >= 0 && lang === 'bash' ? l.search(/(^|\s)#/) : -1

          return (
            <div key={i}>
              {comment >= 0 ? (
                <>
                  {l.slice(0, comment)}
                  <span className={d.comment}>{l.slice(comment)}</span>
                </>
              ) : (
                l || ' '
              )}
            </div>
          )
        })}
      </pre>
    </figure>
  )
}

export default CodeBlock
