'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { Loader2Icon, PlayIcon } from 'lucide-react'

// Component Imports
import CodeBlock from '@/components/shared/CodeBlock'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

// Hook Imports
import { useActionToast } from '@/hooks/use-action-toast'

// Lib Imports
import { queueBuildAction } from '@/lib/actions/jobs'
import { cn } from '@/lib/utils'

export type AgentChoice = { machine: string; online: boolean; busy: boolean; platforms: ('ios' | 'android')[] }

const Choice = ({ active, disabled, onClick, children, sub }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; sub?: string }) => (
  <button
    type='button'
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      active ? 'border-foreground bg-muted font-medium' : 'hover:bg-muted/60'
    )}
  >
    {children}
    {sub && <span className='text-muted-foreground block text-xs font-normal'>{sub}</span>}
  </button>
)

/** Start a build from the dashboard: queued for the agent on the chosen machine. */
const NewBuildDialog = ({ orgSlug, projectId, profiles, agents }: { orgSlug: string; projectId: string; profiles: string[]; agents: AgentChoice[] }) => {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android'>('android')
  const [profile, setProfile] = useState(profiles.includes('production') ? 'production' : (profiles[0] ?? 'production'))
  const [machine, setMachine] = useState(agents.find(a => a.online)?.machine ?? agents[0]?.machine ?? '')
  const [submit, setSubmit] = useState(false)
  const [clean, setClean] = useState(false)
  const { run, pending } = useActionToast()

  const selected = agents.find(a => a.machine === machine)
  const iosBlocked = platform === 'ios' && selected && !selected.platforms.includes('ios')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlayIcon /> New build
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>New build</DialogTitle>
          <DialogDescription>Runs on one of your machines through its agent, with logs here as usual.</DialogDescription>
        </DialogHeader>

        {agents.length === 0 ? (
          <div className='space-y-3 text-sm'>
            <p>No machine is connected yet. In the project folder on the machine that should build, run:</p>
            <CodeBlock code='npx localxpo agent' />
            <p className='text-muted-foreground text-xs'>It stays connected and runs what you start here. Keep it open (or run it in a terminal tab) while you build.</p>
          </div>
        ) : (
          <div className='space-y-5'>
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Platform</p>
              <div className='grid grid-cols-2 gap-2'>
                <Choice active={platform === 'android'} onClick={() => setPlatform('android')}>
                  Android
                </Choice>
                <Choice active={platform === 'ios'} onClick={() => setPlatform('ios')}>
                  iOS
                </Choice>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Profile</p>
              <div className='flex flex-wrap gap-2'>
                {profiles.map(p => (
                  <Choice key={p} active={profile === p} onClick={() => setProfile(p)}>
                    <span className='font-mono text-xs'>{p}</span>
                  </Choice>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Machine</p>
              <div className='grid gap-2'>
                {agents.map(a => (
                  <Choice
                    key={a.machine}
                    active={machine === a.machine}
                    onClick={() => setMachine(a.machine)}
                    sub={
                      !a.online
                        ? 'agent offline: the build waits until it reconnects'
                        : a.busy
                          ? 'online · busy, the build queues after the current one'
                          : `online · builds ${a.platforms.map(p => (p === 'ios' ? 'iOS' : 'Android')).join(' + ')}`
                    }
                  >
                    <span className='flex items-center gap-2'>
                      <span className={cn('size-2 rounded-full', a.online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} aria-hidden />
                      {a.machine}
                    </span>
                  </Choice>
                ))}
              </div>
              {iosBlocked && <p className='text-xs text-red-700 dark:text-red-300'>This machine can&apos;t build iOS: that needs a Mac with Xcode.</p>}
            </div>

            <div className='space-y-3'>
              <label className='flex items-center justify-between gap-4 text-sm'>
                <span>
                  Submit to the store when it succeeds
                  <span className='text-muted-foreground block text-xs'>{platform === 'ios' ? 'TestFlight' : 'Google Play, track from eas.json'}</span>
                </span>
                <Switch checked={submit} onCheckedChange={setSubmit} />
              </label>
              <label className='flex items-center justify-between gap-4 text-sm'>
                <span>
                  Clean build
                  <span className='text-muted-foreground block text-xs'>Regenerate the native folder from scratch</span>
                </span>
                <Switch checked={clean} onCheckedChange={setClean} />
              </label>
            </div>
          </div>
        )}

        {agents.length > 0 && (
          <DialogFooter>
            <Button
              disabled={pending || !machine || Boolean(iosBlocked)}
              onClick={() =>
                run(
                  async () => {
                    const res = await queueBuildAction(orgSlug, projectId, { platform, profile, machine, submit, clean })

                    if (!res.error) setOpen(false)

                    return res
                  },
                  { loading: 'Queuing build…', success: 'Build queued.' }
                )
              }
            >
              {pending ? <Loader2Icon className='animate-spin' /> : <PlayIcon />}
              Start build
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default NewBuildDialog
