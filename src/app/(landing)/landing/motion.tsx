'use client'

// React Imports
import { useEffect, useRef, useState, type ReactNode } from 'react'

import s from './landing.module.css'

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** True once the element has scrolled into view (and stays true). */
export const useInView = <T extends Element>(margin = '0px 0px -15% 0px') => {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: margin }
    )

    io.observe(el)

    return () => io.disconnect()
  }, [margin])

  return [ref, seen] as const
}

/** True while the element is on screen (live demos pause when scrolled away). */
export const useOnScreen = <T extends Element>() => {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const io = new IntersectionObserver(entries => setOn(entries.some(e => e.isIntersecting)))

    io.observe(el)

    return () => io.disconnect()
  }, [])

  return [ref, on] as const
}

/**
 * Transparent over the hero, compact and frosted once the page scrolls.
 * Children are rendered on the server (links, auth buttons).
 */
export const LandingHeader = ({ children }: { children: ReactNode }) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={s.header} data-scrolled={scrolled || undefined}>
      {children}
    </header>
  )
}

/**
 * Parallax for every `[data-speed]` element inside the page: it drifts by `speed` × its distance from the
 * middle of the screen. One rAF loop for the whole page, transforms only, off with reduced motion.
 */
export const ParallaxController = () => {
  useEffect(() => {
    if (reducedMotion()) return

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-speed]'))
    let frame = 0

    const update = () => {
      frame = 0
      const mid = window.innerHeight / 2

      for (const el of els) {
        // Measure the untransformed parent so the movement doesn't feed back into the measure.
        const box = (el.parentElement ?? el).getBoundingClientRect()

        if (box.bottom < -200 || box.top > window.innerHeight + 200) continue

        const offset = (box.top + box.height / 2 - mid) * Number(el.dataset.speed)

        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
      }
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return null
}

/**
 * Scroll reveals: every `[data-reveal]` element fades and rises once when it enters the screen (stagger with
 * `--d`). Elements stay visible without JavaScript, and with reduced motion nothing moves.
 */
export const RevealController = () => {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.lx-landing')

    if (!root || reducedMotion()) return

    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    const vh = window.innerHeight

    // Anything already on screen at load stays put; only what's below the fold is revealed on scroll.
    const below = els.filter(el => el.getBoundingClientRect().top > vh * 0.92)

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.on = ''
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    )

    for (const el of els) {
      if (below.includes(el)) io.observe(el)
      else el.dataset.on = ''
    }

    // Only now hide what's still below the fold, so nothing on screen flickers.
    root.dataset.revealReady = ''

    return () => io.disconnect()
  }, [])

  return null
}
