'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { LogOutIcon, SettingsIcon, TerminalIcon } from 'lucide-react'

// Component Imports
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Action Imports
import { logoutAction } from '@/lib/actions/auth'

export type HeaderUser = { name: string; email: string }

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('') || '?'

const ProfileDropdown = ({ user }: { user: HeaderUser }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant='ghost' size='icon' className='rounded-full hover:bg-transparent' />}>
        <Avatar>
          <AvatarFallback className='bg-primary text-primary-foreground text-xs font-semibold'>
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className='sr-only'>Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='flex items-center gap-3 px-2 py-2.5 font-normal'>
            <Avatar className='size-10'>
              <AvatarFallback className='bg-primary text-primary-foreground font-semibold'>
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className='flex min-w-0 flex-1 flex-col items-start'>
              <span className='text-foreground w-full truncate text-base font-semibold'>{user.name}</span>
              <span className='text-muted-foreground w-full truncate text-sm'>{user.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href='/account' />}>
            <SettingsIcon />
            <span>Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href='/account/tokens' />}>
            <TerminalIcon />
            <span>CLI & tokens</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant='destructive' onClick={() => logoutAction()}>
            <LogOutIcon />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileDropdown
