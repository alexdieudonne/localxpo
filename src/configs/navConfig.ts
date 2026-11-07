// Third-party Imports
import {
  ActivityIcon,
  BarChart3Icon,
  BoxIcon,
  BoxesIcon,
  CreditCardIcon,
  FingerprintIcon,
  KeyRoundIcon,
  LaptopIcon,
  LayoutGridIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
  VariableIcon,
  WrenchIcon,
  type LucideIcon
} from 'lucide-react'

export type NavLink = {
  label: string

  /** Relative to the section base (org or project URL). '' is the base itself. */
  path: string
  icon: LucideIcon

  /** Also active on sub-pages (e.g. builds/[id]). */
  prefix?: boolean
}

export type NavSection = { label: string; items: NavLink[] }

export const projectNav: NavSection[] = [
  {
    label: 'Project',
    items: [
      { label: 'Overview', path: '', icon: LayoutGridIcon },
      { label: 'Insights', path: '/insights', icon: BarChart3Icon },
      { label: 'Environment variables', path: '/environment-variables', icon: VariableIcon },
      { label: 'Settings', path: '/settings', icon: SettingsIcon }
    ]
  },
  {
    label: 'Develop',
    items: [
      { label: 'Development builds', path: '/development-builds', icon: WrenchIcon },
      { label: 'Fingerprints', path: '/fingerprints', icon: FingerprintIcon }
    ]
  },
  {
    label: 'Ship',
    items: [
      { label: 'Builds', path: '/builds', icon: BoxIcon, prefix: true },
      { label: 'Submissions', path: '/submissions', icon: SendIcon }
    ]
  }
]

export const orgNav: NavSection[] = [
  {
    label: 'Organization',
    items: [
      { label: 'Projects', path: '', icon: BoxesIcon },
      { label: 'Activity', path: '/activity', icon: ActivityIcon },
      { label: 'Machines', path: '/machines', icon: LaptopIcon },
      { label: 'Members', path: '/members', icon: UsersIcon },
      { label: 'Credentials', path: '/credentials', icon: KeyRoundIcon },
      { label: 'Settings', path: '/settings', icon: SettingsIcon }
    ]
  }
]

/** localxpo Cloud adds Billing (self-hosted servers have no plans). */
export const orgNavCloud: NavSection[] = orgNav.map(section => ({
  ...section,
  items: section.items.flatMap(item =>
    item.path === '/settings' ? [{ label: 'Billing', path: '/billing', icon: CreditCardIcon }, item] : [item]
  )
}))
