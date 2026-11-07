'use client'

// React Imports
import { useEffect, useState } from 'react'

import d from './docs.module.css'

export type TocGroup = { title: string; items: { id: string; label: string }[] }

/** Sidebar navigation of the docs; the section on screen is highlighted. */
const Toc = ({ groups }: { groups: TocGroup[] }) => {
  const [active, setActive] = useState(groups[0]?.items[0]?.id)

  useEffect(() => {
    const ids = groups.flatMap(g => g.items.map(i => i.id))
    const els = ids.map(id => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e))

    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' }
    )

    els.forEach(el => io.observe(el))

    return () => io.disconnect()
  }, [groups])

  return (
    <nav className={d.toc} aria-label='Documentation'>
      {groups.map(g => (
        <div key={g.title}>
          <p className={d.tocTitle}>{g.title}</p>
          <ul>
            {g.items.map(i => (
              <li key={i.id}>
                <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined} data-active={active === i.id || undefined}>
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default Toc
