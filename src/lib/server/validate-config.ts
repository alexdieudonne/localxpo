/**
 * Friendly checks on the evaluated Expo config (`npx expo config --json`) and eas.json.
 * The goal is to catch, before a 20-minute build, the mistakes that make stores reject a build.
 */

export type ConfigCheck = {
  level: 'ok' | 'warning' | 'error'
  title: string
  detail: string
}

 
type AnyObj = Record<string, any>

const BUNDLE_ID_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const ANDROID_PKG_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/

export const validateExpoConfig = (config: AnyObj | null, eas: AnyObj | null): ConfigCheck[] => {
  const checks: ConfigCheck[] = []
  const add = (level: ConfigCheck['level'], title: string, detail: string) => checks.push({ level, title, detail })

  if (!config) {
    add('warning', 'No config synced yet', 'Run `localxpo init` or a build from your project folder to sync app.json.')

    return checks
  }

  const ios: AnyObj = config.ios ?? {}
  const android: AnyObj = config.android ?? {}

  // Identity
  if (!config.version) add('error', 'Missing version', 'Set "version" (e.g. "1.0.0") in app.json.')
  else add('ok', `Version ${config.version}`, 'Shown to users in the stores.')

  if (!ios.bundleIdentifier) add('warning', 'Missing ios.bundleIdentifier', 'Required to build for iOS.')
  else if (!BUNDLE_ID_RE.test(ios.bundleIdentifier))
    add('error', 'Invalid ios.bundleIdentifier', `"${ios.bundleIdentifier}" must look like com.company.app.`)
  else add('ok', `iOS bundle ID ${ios.bundleIdentifier}`, 'Valid reverse-DNS identifier.')

  if (!android.package) add('warning', 'Missing android.package', 'Required to build for Android.')
  else if (!ANDROID_PKG_RE.test(android.package))
    add(
      'error',
      'Invalid android.package',
      `"${android.package}" must use letters, digits and underscores, separated by dots.`
    )
  else add('ok', `Android package ${android.package}`, 'Valid Java package name.')

  // Build numbers
  const autoIncrement = eas
    ? Object.values<AnyObj>(eas.build ?? {}).some(p => p?.autoIncrement || p?.ios?.autoIncrement || p?.android?.autoIncrement)
    : false

  if (!ios.buildNumber && !autoIncrement)
    add('warning', 'No ios.buildNumber', 'Defaults to "1". Each App Store upload needs a higher build number.')

  if (!android.versionCode && !autoIncrement)
    add('warning', 'No android.versionCode', 'Defaults to 1. Each Play upload needs a higher versionCode.')

  // Assets
  if (!config.icon && !ios.icon && !android.adaptiveIcon)
    add('error', 'No app icon', 'Set "icon" to a 1024x1024 PNG. Apple rejects builds without one.')

  // iOS submission gotchas
  if (ios.bundleIdentifier && ios.infoPlist?.ITSAppUsesNonExemptEncryption === undefined && ios.config?.usesNonExemptEncryption === undefined)
    add(
      'warning',
      'Export compliance not declared',
      'Add ios.config.usesNonExemptEncryption: false (if true, fill the form in App Store Connect) to skip the compliance prompt on every TestFlight build.'
    )

  // Updates
  if (config.updates?.url && !config.runtimeVersion)
    add('warning', 'updates.url without runtimeVersion', 'Set runtimeVersion (e.g. { "policy": "appVersion" }) so updates only reach compatible builds.')

  // eas.json
  if (!eas) {
    add('warning', 'No eas.json', 'localxpo falls back to a single "production" profile. Add eas.json to define development/preview/production.')
  } else {
    const profiles = Object.keys(eas.build ?? {})

    if (profiles.length === 0) add('error', 'eas.json has no build profiles', 'Add at least a "production" profile under "build".')
    else add('ok', `${profiles.length} build profile${profiles.length > 1 ? 's' : ''}`, profiles.join(', '))
  }

  return checks
}
