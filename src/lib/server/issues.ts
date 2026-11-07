/**
 * Turns raw Xcode / Gradle / Metro / npm output into short, actionable explanations.
 * Runs on the server as log lines arrive, so the CLI and the dashboard show the same thing.
 */

export type BuildIssue = {
  id: string
  title: string
  explanation: string
  fix: string
  line: string
  seq: number
  step: string
  docsUrl?: string
}

type Pattern = {
  id: string
  test: RegExp
  title: string
  explanation: string
  fix: string
  docsUrl?: string
}

const PATTERNS: Pattern[] = [
  // ---------- fastlane ----------
  {
    id: 'fastlane-missing',
    test: /fastlane: command not found|Could not find 'fastlane'|bundler: command not found: fastlane/i,
    title: 'fastlane is not installed',
    explanation: 'localxpo runs every native step (CocoaPods, Xcode, Gradle, uploads) through fastlane.',
    fix: 'Install it with `brew install fastlane` (macOS) or `gem install fastlane`. If your project has a Gemfile with fastlane, run `bundle install`.'
  },
  {
    id: 'fastlane-old',
    test: /Could not find option '(xcodebuild_formatter|api_key|skip_package_ipa)'|undefined method `app_store_connect_api_key'/i,
    title: 'fastlane is too old',
    explanation: 'This build uses fastlane options that only exist in recent versions.',
    fix: 'Update fastlane to 2.210 or newer (`brew upgrade fastlane`, `gem update fastlane` or `bundle update fastlane`).'
  },
  {
    id: 'asc-app-missing',
    test: /Could not find (an )?app with (the )?bundle identifier|Couldn't find app '[^']+' on the account/i,
    title: 'App not created in App Store Connect',
    explanation: 'TestFlight uploads need an app record with this bundle ID in App Store Connect.',
    fix: 'In App Store Connect > Apps, click + > New App and use the same bundle identifier as ios.bundleIdentifier, then upload again.'
  },
  {
    id: 'asc-version-used',
    test: /already been used|The provided entity includes an attribute with a value that has already been used|ENTITY_ERROR\.ATTRIBUTE\.INVALID\.DUPLICATE/i,
    title: 'This build number was already uploaded',
    explanation: 'App Store Connect refuses a second build with the same version and build number.',
    fix: 'Increase ios.buildNumber (or android.versionCode) in app.json and build again.'
  },
  {
    id: 'gym-archive-failed',
    test: /Error building the application - see the log above|Archive Failed|Exit status: 65/i,
    title: 'Xcode build failed (fastlane gym)',
    explanation: 'xcodebuild exited with an error while archiving.',
    fix: 'The real cause is in the lines just above this one (look for "error:"). Signing and Metro errors are the most common.'
  },
  {
    id: 'supply-permission',
    test: /Google Api Error: (forbidden|unauthorized)|The current user has insufficient permissions/i,
    title: 'The service account cannot release this app',
    explanation: 'Google Play accepted the key but the service account lacks permission for this app.',
    fix: 'In Play Console > Users and permissions, give the service account "Release to testing tracks" (or production) for this app.'
  },

  // ---------- iOS signing ----------
  {
    id: 'ios-no-team',
    test: /requires a development team|DEVELOPMENT_TEAM[^\n]{0,200}(empty|not set)/i,
    title: 'No Apple development team selected',
    explanation: 'Xcode needs to know which Apple Developer team signs the app.',
    fix: 'Add your App Store Connect API key (with Team ID) on the Credentials page, or set ios.appleTeamId in app.json.'
  },
  {
    id: 'ios-no-profile',
    test: /No profiles for '([^']+)' were found|requires a provisioning profile|No matching provisioning profiles? found/i,
    title: 'No provisioning profile for this bundle ID',
    explanation:
      'Apple has no provisioning profile that matches the bundle identifier, and Xcode could not create one automatically.',
    fix: 'Make sure the API key on the Credentials page has the "App Manager" or "Admin" role so profiles can be created, and that ios.bundleIdentifier in app.json is correct.'
  },
  {
    id: 'ios-no-certificate',
    test: /No signing certificate "[^"]+" found|doesn't include signing certificate|No certificate for team/i,
    title: 'Missing distribution certificate',
    explanation: 'The signing certificate is missing from this Mac, or the profile was made with a different one.',
    fix: 'With an API key configured, Xcode creates and downloads certificates itself. If you hit the 3-certificate limit, revoke an old one in developer.apple.com > Certificates.'
  },
  {
    id: 'ios-app-id-taken',
    test: /An App ID with Identifier '([^']+)' is not available|bundle identifier [^\n]{0,200} (is not available|cannot be registered)/i,
    title: 'Bundle identifier already taken',
    explanation: 'Another Apple team already registered this bundle identifier.',
    fix: 'Pick a unique ios.bundleIdentifier in app.json (for example com.yourcompany.appname).'
  },
  {
    id: 'ios-asc-auth',
    test: /authentication credentials are missing or invalid|NOT_AUTHORIZED|Unable to authenticate with App Store Connect|AuthenticationFailed/i,
    title: 'App Store Connect rejected the API key',
    explanation: 'The Key ID, Issuer ID or .p8 file is wrong, or the key was revoked.',
    fix: 'Re-upload the key on the Credentials page. Check that Key ID and Issuer ID match the values shown in App Store Connect > Users and Access > Integrations.'
  },
  {
    id: 'ios-build-number-used',
    test: /bundle version must be higher than the previously uploaded version|CFBundleVersion[^\n]{0,200}(already been used|must be higher)|redundant binary upload/i,
    title: 'Build number already uploaded',
    explanation: 'App Store Connect already has a build with this version and build number.',
    fix: 'Increase ios.buildNumber in app.json (or enable autoIncrement in eas.json) and build again.'
  },

  // ---------- iOS tooling ----------
  {
    id: 'cocoapods-missing',
    test: /pod: command not found|CocoaPods is not installed|Could not find 'cocoapods'/i,
    title: 'CocoaPods is not installed',
    explanation: 'Expo iOS projects need CocoaPods to install native dependencies.',
    fix: 'Install it with `brew install cocoapods` (or `sudo gem install cocoapods`), then retry.'
  },
  {
    id: 'cocoapods-out-of-sync',
    test: /CocoaPods could not find compatible versions|sandbox is not in sync with the Podfile\.lock|pod repo update/i,
    title: 'CocoaPods dependencies out of date',
    explanation: 'The pods specs on this machine are older than what your dependencies need.',
    fix: 'Run `pod repo update` (or rebuild with --clean to regenerate the ios folder).'
  },
  {
    id: 'xcode-license',
    test: /You have not agreed to the Xcode license/i,
    title: 'Xcode license not accepted',
    explanation: 'Xcode refuses to build until its license is accepted on this Mac.',
    fix: 'Run `sudo xcodebuild -license accept`.'
  },
  {
    id: 'xcode-version',
    test: /requires a minimum of Xcode|is not compatible with the current Xcode|iOS [\d.]+ Platform Not Installed|Unable to find a destination matching/i,
    title: 'Xcode or iOS platform version mismatch',
    explanation: 'This project needs a newer Xcode or an iOS platform that is not installed.',
    fix: 'Update Xcode from the App Store, then install the iOS platform in Xcode > Settings > Components.'
  },
  {
    id: 'xcode-node-binary',
    test: /node: (command )?not found|Can't find ['"]?node['"]?|NODE_BINARY/i,
    title: 'Xcode cannot find Node.js',
    explanation: 'Xcode build scripts run without your shell profile, so they may not see Node installed by nvm/fnm/volta.',
    fix: 'Create ios/.xcode.env.local with `export NODE_BINARY=$(command -v node)`.'
  },
  {
    id: 'xcode-script-phase',
    test: /Command PhaseScriptExecution failed with a nonzero exit code/i,
    title: 'An Xcode build script failed',
    explanation: 'One of the build phases (often the JS bundling step or a pod script) exited with an error.',
    fix: 'Look at the lines just above this one in the log: they contain the real error, often from Metro bundling.'
  },

  // ---------- Android ----------
  {
    id: 'android-sdk-missing',
    test: /SDK location not found|ANDROID_HOME (is )?not set|ANDROID_SDK_ROOT/i,
    title: 'Android SDK not found',
    explanation: 'Gradle needs the Android SDK path.',
    fix: 'Install Android Studio, then add `export ANDROID_HOME=$HOME/Library/Android/sdk` to your shell profile (or create android/local.properties with sdk.dir=...).'
  },
  {
    id: 'android-java-version',
    test: /Unsupported class file major version|requires Java (\d+)|Android Gradle plugin requires Java|invalid source release: \d+|JAVA_HOME is not set/i,
    title: 'Wrong Java version',
    explanation: 'The Android Gradle Plugin needs a specific JDK (JDK 17 for current Expo SDKs).',
    fix: 'Install JDK 17 (`brew install --cask zulu@17`) and point JAVA_HOME to it.'
  },
  {
    id: 'android-oom',
    test: /OutOfMemoryError|Java heap space|Metaspace|Daemon [^\n]{0,200} disappeared unexpectedly/i,
    title: 'Gradle ran out of memory',
    explanation: 'The Gradle daemon needs more memory for this project.',
    fix: 'Set org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g in android/gradle.properties (or via an expo config plugin).'
  },
  {
    id: 'android-keystore',
    test: /Keystore was tampered with, or password was incorrect|KeytoolException|Failed to read key [^\n]{0,200} from store/i,
    title: 'Keystore password or alias is wrong',
    explanation: 'The upload keystore could not be opened with the stored password or alias.',
    fix: 'Check the Android keystore on the Credentials page. If you replaced it locally, delete it there and let the CLI upload the new one.'
  },
  {
    id: 'android-version-code-used',
    test: /Version code \d+ has already been used|APK specifies a version code that has already been used/i,
    title: 'Version code already used on Google Play',
    explanation: 'Google Play already has a build with this versionCode.',
    fix: 'Increase android.versionCode in app.json and build again.'
  },
  {
    id: 'play-first-upload',
    test: /Package not found: |applicationNotFound/i,
    title: 'Google Play cannot find the app',
    explanation:
      'The very first upload of an app must be done by hand in Play Console, and the service account must be invited to it.',
    fix: 'Create the app in Play Console, upload this first .aab manually to an internal track, and grant the service account "Release" permissions. Later uploads will work from the CLI.'
  },

  {
    id: 'play-draft-app',
    test: /Only releases with status draft may be created on draft app/i,
    title: 'App is still a draft on Google Play',
    explanation: 'Until the store listing is complete and the app has been reviewed once, Google only accepts draft releases.',
    fix: 'Set "releaseStatus": "draft" under submit.<profile>.android in eas.json, then publish the draft from Play Console.'
  },

  // ---------- JS / Metro / packages ----------
  {
    id: 'metro-unresolved',
    test: /Unable to resolve module ([^\s]+)/i,
    title: 'JavaScript import cannot be resolved',
    explanation: 'Metro could not find a module that your code imports.',
    fix: 'Install the missing package (`npx expo install <name>`) or fix the import path. Check case sensitivity: macOS is forgiving, builds sometimes are not.'
  },
  {
    id: 'lockfile-outdated',

    // Real error messages only: the install command itself contains `--frozen-lockfile` on every build.
    test: /ERR_PNPM_OUTDATED_LOCKFILE|npm ci can only install packages when your package\.json and package-lock\.json|lockfile needs to be updated|lockfile had changes, but lockfile is frozen|The lockfile would have been modified by this install/i,
    title: 'Lockfile out of sync with package.json',
    explanation: 'Dependencies changed but the lockfile was not updated.',
    fix: 'Run your package manager install locally, commit the updated lockfile, then build again.'
  },
  {
    id: 'node-version',
    test: /Unsupported engine|The engine "node" is incompatible|requires Node(?:\.js)? (?:version )?>=?\s*\d+/i,
    title: 'Node.js version too old',
    explanation: 'A dependency requires a newer Node.js.',
    fix: 'Install the current LTS (`nvm install --lts`) and retry.'
  },
  {
    id: 'expo-config-error',
    test: /Error: Cannot (?:find module|resolve) [^\n]{0,200} app\.config|PluginError|Failed to resolve plugin/i,
    title: 'Expo config could not be evaluated',
    explanation: 'app.json / app.config.js or one of its config plugins threw an error.',
    fix: 'Run `npx expo config` locally to see the full error, and check that every plugin in the "plugins" array is installed.'
  },

  // ---------- Machine ----------
  {
    id: 'disk-full',
    test: /No space left on device|ENOSPC/i,
    title: 'Disk is full',
    explanation: 'The build machine ran out of disk space.',
    fix: 'Free space, e.g. delete ~/Library/Developer/Xcode/DerivedData and old simulators (`xcrun simctl delete unavailable`).'
  },
  {
    id: 'network',
    test: /ETIMEDOUT|ECONNRESET|getaddrinfo ENOTFOUND|Could not resolve host|Connection timed out|Unable to tunnel through proxy|PKIX path building failed|Could not (GET|HEAD|resolve all (files|dependencies))|UnknownHostException/i,
    title: 'Network error',
    explanation: 'A download (npm, CocoaPods, Gradle or Maven) failed because of the network, a proxy or a firewall.',
    fix: 'Check your connection. Behind a corporate proxy, configure it for Gradle in ~/.gradle/gradle.properties (systemProp.https.proxyHost / proxyPort) and for npm with `npm config set proxy`.'
  }
]

const GENERIC_ERROR =
  /(^|\s)(error|fatal):|\*\* (ARCHIVE|BUILD|EXPORT) FAILED \*\*|FAILURE: Build failed|BUILD FAILED|^E\s|Exception:|npm ERR!|ERR_PNPM/i

export type LogLineInput = { seq: number; step: string; stream: string; line: string }

/** Lines worth surfacing even without a known pattern. */
export const isErrorLine = (line: string) => GENERIC_ERROR.test(line)

/** Adds newly matched issues to `existing`. Each pattern is reported once (first occurrence). */
export const detectIssues = (lines: LogLineInput[], existing: BuildIssue[]): BuildIssue[] => {
  const seen = new Set(existing.map(i => i.id))
  const out = [...existing]

  for (const l of lines) {
    // Fast pre-filter: most lines are noise.
    if (l.line.length > 2000) continue

    for (const p of PATTERNS) {
      if (seen.has(p.id)) continue

      if (p.test.test(l.line)) {
        seen.add(p.id)
        out.push({
          id: p.id,
          title: p.title,
          explanation: p.explanation,
          fix: p.fix,
          docsUrl: p.docsUrl,
          line: l.line.trim().slice(0, 500),
          seq: l.seq,
          step: l.step
        })
      }
    }
  }

  return out
}
