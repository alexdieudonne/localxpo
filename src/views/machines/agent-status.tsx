'use client'

// React Imports
import { createContext, useContext, useEffect, useState } from 'react'

// Lib Imports
import { cn } from '@/lib/utils'

export type AgentLive = { machine: string; online: boolean; busy: boolean; lastSeen: number; version: string | null; platforms: string[]; projects: number }

const Ctx = createContext<{ agents: AgentLive[]; now: number }>({ agents: [], now: 0 })

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))

  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)

  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

/** Polls the agents' check-ins every 5 s so the badges follow reality without reloading the page. */
export const AgentStatusProvider = ({ orgSlug, initial, serverNow, children }: { orgSlug: string; initial: AgentLive[]; serverNow: number; children: React.ReactNode }) => {
  const [agents, setAgents] = useState(initial)

  // Server's clock for the first render (same HTML on both sides), then the browser's.
  const [now, setNow] = useState(serverNow)

  useEffect(() => {
    let stopped = false

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/orgs/${orgSlug}/agents`, { cache: 'no-store' })

        if (res.ok && !stopped) setAgents(((await res.json()) as { agents: AgentLive[] }).agents)
      } catch {
        /* keep the last known state */
      }

      if (!stopped) setNow(Date.now())
    }

    const t = setInterval(load, 5000)

    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [orgSlug])

  return <Ctx.Provider value={{ agents, now }}>{children}</Ctx.Provider>
}

/** Online / Offline, with what the agent is doing or when it was last heard from. */
export const AgentBadge = ({ machine }: { machine: string }) => {
  const { agents, now } = useContext(Ctx)
  const a = agents.find(x => x.machine === machine)
  const online = Boolean(a?.online)
  const detail = online ? (a!.busy ? 'building' : `${a!.projects} project${a!.projects > 1 ? 's' : ''}`) : a ? `last seen ${ago(now - a.lastSeen)}` : 'agent not started'

  return (
    <span
      className={cn('ml-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-normal', online ? 'text-foreground' : 'text-muted-foreground')}
      title={online ? `Agent v${a!.version ?? '?'} checked in ${ago(now - a!.lastSeen)}` : 'Run `npx localxpo agent` in a project folder on this machine'}
    >
      <span className={cn('size-2 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} aria-hidden />
      <span className='font-medium'>{online ? 'Online' : 'Offline'}</span>
      <span className='text-muted-foreground'>· {detail}</span>
    </span>
  )
}

/** "Online now: …" line under the agent command. */
export const OnlineSummary = () => {
  const { agents } = useContext(Ctx)
  const online = agents.filter(a => a.online)

  return <>{online.length ? `Online now: ${online.map(a => a.machine).join(', ')}` : 'No agent online right now.'}</>
}
