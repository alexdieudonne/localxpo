/** Sign-up questions (localxpo Cloud). Shared by the registration form and the server action that validates it. */

export type Choice<T extends string = string> = { value: T; label: string; hint?: string }

export const COMPANY_SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: '2-10', label: '2–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201+', label: '201+' }
] as const satisfies readonly Choice[]

export const REFERRAL_SOURCES = [
  { value: 'search', label: 'Search engine' },
  { value: 'github', label: 'GitHub' },
  { value: 'social', label: 'X, LinkedIn or Reddit' },
  { value: 'expo', label: 'Expo community' },
  { value: 'friend', label: 'Friend or colleague' },
  { value: 'blog', label: 'Blog, newsletter or video' },
  { value: 'ai', label: 'An AI assistant' },
  { value: 'other', label: 'Something else' }
] as const satisfies readonly Choice[]

export const USE_CASES = [
  { value: 'own_apps', label: 'Ship my own apps', hint: 'Side projects or indie apps' },
  { value: 'company_app', label: 'Build our company’s app', hint: 'A product team shipping to the stores' },
  { value: 'client_apps', label: 'Ship apps for clients', hint: 'Agency or freelance work' },
  { value: 'ci', label: 'Automate builds in CI', hint: 'GitHub Actions, schedules, release trains' },
  { value: 'replace_cloud', label: 'Cut cloud build costs', hint: 'Move builds off a paid build service' },
  { value: 'exploring', label: 'Just exploring', hint: 'Seeing what localxpo can do' }
] as const satisfies readonly Choice[]

export type CompanySize = (typeof COMPANY_SIZES)[number]['value']
export type ReferralSource = (typeof REFERRAL_SOURCES)[number]['value']
export type UseCase = (typeof USE_CASES)[number]['value']

export const values = <T extends readonly Choice[]>(list: T) => list.map(c => c.value) as unknown as [T[number]['value'], ...T[number]['value'][]]
