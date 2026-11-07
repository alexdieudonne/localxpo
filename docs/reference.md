# localxpo reference

Build Expo apps **on your own machine, for free**, and follow every build from a web dashboard:
live logs, plain-language explanations of errors, and store credentials that take one upload instead of an afternoon.

```
┌──────────────┐   logs + status (HTTPS, batched)   ┌──────────────────────────┐
│ localxpo   │ ─────────────────────────────────▶ │ Dashboard (Next.js)      │
│ CLI on your  │ ◀───────────────────────────────── │ Postgres, password auth, │
│ Mac / PC     │   store keys (encrypted, token)    │ error analysis           │
└──────────────┘                                     └──────────────────────────┘
   expo prebuild · gradle · xcodebuild                 never runs builds, never stores binaries
```

## Dashboard layout

The sidebar has two parts: a **rail** on the far left with one tile per organization (plus *new organization*, *CLI & tokens* and your account), and a **context panel** with an *Organization / Project* toggle, a searchable project picker, and the navigation:

| Organization (`/:org`) | Project (`/:org/projects/:project`) |
|---|---|
| Projects · Activity · Members · Credentials · Settings | **Project:** Overview · Insights · Environment variables · Settings<br>**Develop:** Development builds · Fingerprints<br>**Ship:** Builds · Submissions |

- Everyone gets a personal organization on sign-up; create shared ones with the **+** tile on the rail and add teammates (who registered on the same server) on **Members**. Owners manage members, credentials and settings; members see everything and can build.
- **Credentials** (Apple key, Google service account) belong to the organization; the Android keystore belongs to the project.
- **Environment variables** are per project and per environment (development / preview / production), injected by the CLI. The environment follows the eas.json profile's `environment`, otherwise the profile name. Secrets are hidden in the UI and redacted from logs.
- **Fingerprints** come from `@expo/fingerprint` (bundled with recent Expo SDKs). When a successful build already has the same native fingerprint, the CLI tells you a rebuild isn't needed.
- **Submissions** are jobs of their own, each with live logs, status and error explanations: started by `build --submit` (after the build finishes) or later with `npx localxpo submit`. The build page links to its submissions.

## What's in this repo

| Path | What |
|---|---|
| `src/` | The dashboard (Next.js 16, shadcn/ui, based on the AdminCN template) |
| `src/lib/server/` | Postgres schema + migrations, auth (scrypt + sessions + API tokens), builds, logs, credentials (AES-256-GCM), error patterns |
| `src/app/api/v1/` | REST API used by the CLI and by the live log viewer |
| `cli/` | The `localxpo` CLI (Node ≥ 20, TypeScript, two dependencies). **Not committed** (gitignored): distributed on npm |

## Run the dashboard

```bash
pnpm install
pnpm dev                      # http://localhost:3000
```

Open `/register`, create your account, and you're in.

**Database.** localxpo runs on Postgres. With nothing configured it uses an embedded Postgres (PGlite) stored in `./data/pglite`, so self-hosting needs no database server. To use a real Postgres (Neon, Supabase, Railway, your own), set `DATABASE_URL`; the schema is created and migrated automatically on start. The encryption key for store credentials is generated into `./data/.secret`.

**Upgrading from the SQLite version.** On the first start, if the database is empty and `./data/localxpo.db` exists, its data is copied over automatically and the old file is kept as `localxpo.db.imported`. To copy it into a hosted Postgres instead:

```bash
DATABASE_URL=postgres://… LOCALXPO_SKIP_SQLITE_IMPORT=1 pnpm db:import data/localxpo.db
```

Keep the same `LOCALXPO_SECRET` (or `data/.secret`) so saved store keys can still be decrypted.

Production:

```bash
pnpm build && pnpm start
```

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | – | Postgres connection string. Unset: embedded Postgres in `data/pglite` |
| `DATABASE_POOL_SIZE` | `10` | Max connections when `DATABASE_URL` is set |
| `LOCALXPO_DATA_DIR` | `./data` | Where the embedded database and the generated secret live |
| `LOCALXPO_SECRET` | generated into `data/.secret` | Key used to encrypt store credentials. **Set it in production and back it up**: without it, saved keys can't be decrypted |
| `LOCALXPO_DISABLE_SIGNUP` | – | Set to `1` to close registration after creating your account |
| `NEXT_PUBLIC_APP_URL` | detected from the request | Public URL shown in copy-paste CLI commands |
| `LOCALXPO_INSECURE_COOKIES` | – | Set to `1` to run `pnpm start` over plain http on a LAN |

## The CLI (`cli/`): local only, shipped through npm

The `localxpo` CLI lives in `cli/` while you develop it, but **it is not part of this git repository**: `/cli/` is in `.gitignore`, so it is never committed or pushed. It is a standalone package (its own `package.json`, lockfile and `pnpm-workspace.yaml`). The dashboard installs, builds and deploys without it.

Users get the CLI from npm only:

```bash
npx localxpo link
```

### Work on the CLI

```bash
cd cli
pnpm install
pnpm build              # → cli/dist
node dist/index.js --help
npm link                # optional: puts `localxpo` (and `lxp`) on your PATH
```

### Publish it

From the repo root (or `pnpm release` inside `cli/`):

```bash
pnpm release:cli                 # first time: publishes package.json's version; afterwards bumps the patch
pnpm release:cli minor           # or major, patch, an exact version like 1.2.0
pnpm release:cli --dry-run       # build and show the package contents, publish nothing
pnpm release:cli --server https://lx.example.com   # optional: default server URL suggested by `link`
```

The script (`cli/scripts/publish.sh`) logs you in to npm if needed, type-checks, builds, smoke-tests the CLI, and runs `npm publish`.

**npm account requirements**

- **Two-factor authentication is mandatory to publish.** npm no longer accepts authenticator-app codes for new setups. Add a *security key* at `https://www.npmjs.com/settings/<your-user>/tfa`: Touch ID, a passkey or a hardware key all work. During `npm publish`, npm opens your browser to approve with it.
- **Staged publishing.** npm may hold a new version instead of releasing it, and the package then only shows a `0.0.0-stage` placeholder. In that state `npx localxpo` fails with *"could not determine executable to run"*. Approve the real version:

  ```bash
  npm stage list localxpo
  npm stage approve <stage-id>     # asks for your security key / passkey
  ```

  The publish script prints these commands when it detects a staged version.

`--server` is optional. The CLI always needs to know where your dashboard runs (to sign in and send logs), but `npx localxpo link` asks for it the first time and saves it in the project's `localxpo.json`. `--server` only changes the URL that prompt suggests (default `https://localxpo.app`, localxpo Cloud; pass your own URL when self-hosting).

## Build from the dashboard (agent)

Run the agent once on every machine that should build, inside a linked project folder:

```bash
npx localxpo agent                      # serves this project; remembered in ~/.localxpo/agent.json
npx localxpo agent --dir ../other-app   # serve more projects from the same machine
npx localxpo agent --list               # what this machine serves
```

It checks in with the dashboard every 4 seconds and runs one job at a time. Each job starts the regular CLI in the project folder, so logs, metrics, limits and credentials behave exactly as in a terminal. A Mac builds iOS and Android; any other machine builds Android, which makes it the easy way to keep Android builds off your Mac.

**In the dashboard:**
- **New build** (Builds page): pick the platform, the eas.json profile and the machine, and optionally Submit when done and Clean. With Submit when done, the store upload is its own line in the queue. It waits for the build and starts on the same machine as a separate job once the build has produced its .ipa / .aab. If the build fails, is canceled, or isn't a store build (an .apk, say), the upload is skipped with the reason.
- **Steps** (build page): the list ends with the store upload's status. Click it to open the submission, with its own logs, or the queue while it's waiting.
- **Rebuild** (build page): same platform, profile and options, on the same machine.
- **Submit to TestFlight / Google Play** (build page): runs `localxpo submit --build=<id>` on the machine that has the file.
- **Retry upload** (submission page).
- **Cancel build** / **Cancel upload**: works for builds started from the terminal too. The CLI checks every 3 seconds and stops like Ctrl+C. A build whose machine stopped reporting, or whose CLI is older than 0.3, is just marked as canceled.

Queued jobs appear above the builds list until a machine picks them up, with the reason if one couldn't start. The Machines page shows which agents are online. Ctrl+C on the agent cancels its running job first.

## Use the CLI

In an Expo project (run `link` once; the other commands read `localxpo.json`):

```bash
npx localxpo link                                  # sign in, pick the organization, connect this project, set up store credentials
npx localxpo credentials                           # (re)run the store credentials setup and check store access
npx localxpo agent                                 # keep this machine connected: start / cancel builds from the dashboard
npx localxpo doctor                                # Node, fastlane, JDK, Android SDK, Xcode, CocoaPods…
npx localxpo build -p android --profile preview    # build here, stream logs to the dashboard
npx localxpo build -p ios --profile production --submit   # build, then upload as a separate submission
npx localxpo submit                                # pick one of your builds from a list and upload it
npx localxpo logs -f                               # follow your latest build from any terminal
npx localxpo builds                                # recent builds
npx localxpo orgs                                  # your organizations (`org use <slug>` sets the default)
```

`build` options: `--profile <eas profile>` (default `production`), `--submit`, `--clean` (re-run `expo prebuild --clean`),
`--skip-install`, `-q/--quiet` (only errors and step headers), `-o/--output <dir>` (default `localxpo-output/`), `--org <slug>`.

In CI or on a headless Mac, skip `login`: `LOCALXPO_URL=… LOCALXPO_TOKEN=lx_… localxpo build -p ios`.
Create tokens on **CLI & tokens** in the dashboard.

### What a build does

Every native step runs through **fastlane**. Install it once: `brew install fastlane` (or `gem install fastlane`). If your project has a `Gemfile` that includes fastlane, localxpo uses `bundle exec fastlane` so you get your pinned version.

| Step | Android | iOS (macOS only) |
|---|---|---|
| Read app config | eas.json profile (with `extends`), then `npx expo config` evaluated with the profile's `env`, `EAS_BUILD_PROFILE` and the dashboard's environment variables, so a dynamic `app.config.ts` resolves the same app id as on EAS | same |
| Install dependencies | npm / yarn / pnpm / bun, frozen lockfile | same |
| Compute native fingerprint | `@expo/fingerprint`, compared with earlier builds | same |
| Generate native project | `expo prebuild --clean` when `android/` is missing or gitignored (generated), like EAS; a committed `android/` is kept (bare workflow) unless `--clean`, and the build stops if it was made for another package | same with `ios/` and the bundle ID |
| CocoaPods | – | fastlane `cocoapods` |
| Build | fastlane `gradle` (`:app:bundleRelease`, `assembleRelease` for apk / internal, `assembleDebug` for dev client), signed with injected properties | fastlane `build_app` (gym) with `-allowProvisioningUpdates` and the API key; simulator profiles skip signing |
| Upload (`--submit` or `submit`) | fastlane `upload_to_play_store` (supply) to `submit.<profile>.android.track` | fastlane `upload_to_testflight` (pilot) |

**How fastlane is driven.** For each build the CLI writes a Fastfile (`cli/src/build/fastlane.ts`) into a private temp folder, never into your project, so your own `fastlane/` folder is left alone. Every value (paths, scheme, track, key paths, passwords) is passed as an `LXP_*` environment variable, never interpolated into Ruby. Key files (the .p8, the Play JSON, the keystore) are written to a `0700` folder next to it, and the whole folder is deleted when the build ends, Ctrl+C included. Passwords are redacted from the logs.

### Store credentials, set up for you

`npx localxpo link` ends by setting up everything builds and submissions need, and `npx localxpo credentials` runs the same thing again any time. It asks only for what it cannot find by itself:

1. **What EAS already has.** If you are signed in with `eas login` (or `EXPO_TOKEN` is set), it reads the app's credentials from Expo with the same queries as eas-cli. It imports the **Android upload keystores** of every package (Google Play only accepts the key it knows) and the **App Store Connect key ID, issuer ID and Apple team**. Expo never hands back the private key of an App Store Connect key or a Google service account, so those come from the next steps.
2. **What is already on this machine.** It looks at `eas.json` submit settings (`serviceAccountKeyPath`, `ascApiKeyPath/Id/IssuerId`), `fastlane/Appfile` and api_key JSON files, fastlane env vars, `credentials.json`, `~/.appstoreconnect/private_keys` (and the other altool folders), the project and its parent folder, then `~/Downloads` and `~/Desktop`. Keys are checked before use: a service account JSON must have `type: service_account`, and a .p8 must be a private key. The Apple team comes from the app config, the Xcode project or the signing identities in the keychain.
3. **Creating what is missing.**
   - **Google Play:** with `gcloud` signed in, it creates a `localxpo-play` service account (Play API enabled, JSON key) in the Google Cloud project you pick. Otherwise it opens the Cloud console and picks the key up as soon as it lands in Downloads.
   - **App Store Connect:** it opens Team Keys and catches the `AuthKey_XXXX.p8` download, then reads the Key ID from the filename. It picks the Issuer ID up from your clipboard as soon as you click Copy on that page, or you can paste it. The key is checked with Apple before it's saved, and a wrong Issuer ID is asked again.
   - **Apple team:** when nothing local knows the Team ID, it's read from Apple: the App ID prefix of your registered bundle IDs.
   - **App records:** it checks that each store profile's bundle ID has an app record in App Store Connect. Apple's API can't create one, so it tells you which are missing before the first upload fails.
4. **Checking.**
   - The dashboard verifies each key with Apple or Google before saving it.
   - For Google Play, the CLI opens a test edit on each app. If the service account isn't invited yet, it copies the e-mail to your clipboard, opens Play Console and waits while you invite it. Google doesn't allow that step through its API.
   - If the app doesn't exist on Play yet, it tells you so. Google requires the very first .aab to be uploaded by hand.

`submit` runs the same setup when something is missing, and checks Play access before fastlane starts. App Store Connect and Google Play keys belong to the organization, so only owners can add them. Upload keystores are stored per Android package, because a project can ship one app per profile.

**Signing, without the usual pain**

- **iOS:** upload one App Store Connect API key on **Credentials**. gym passes it to Xcode (`-authenticationKeyPath/-ID/-IssuerID`), and Xcode creates certificates and provisioning profiles by itself. No Apple ID password, no 2FA prompts, no `match` repository. Without a key, Xcode uses the account signed in under Xcode → Settings → Accounts.
- **Android:** each package uses the upload key on the dashboard (imported from EAS when the app was built there), cached in `~/.localxpo/keystores/`. A package with no key gets one on its first release build, backed up (encrypted) to the dashboard so any other machine reuses it.
- **Google Play:** upload a service-account JSON on **Credentials**. The track comes from `submit.<profile>.android.track` in eas.json (default `internal`), the status from `releaseStatus` (default `completed`; use `draft` until the app's first review).

### Submitting later

`npx localxpo submit` fetches the project's successful store builds (not dev-client, internal or simulator builds), keeps the ones whose `.ipa` / `.aab` is on the machine you run it from, and lets you pick one (with a single match it asks for confirmation). Each upload becomes a **submission**: its own record, live logs and error explanations on the Submissions tab, linked to its build. `build --submit` uses the same mechanism once the build has succeeded.

```bash
npx localxpo submit                    # choose from a list
npx localxpo submit --latest           # newest build on this machine, no prompt (also the default without a terminal, e.g. CI)
npx localxpo submit --build=<id>       # a specific build (id from the dashboard or `npx localxpo builds`)
npx localxpo submit --path app.aab     # any .ipa / .aab, even one not built by localxpo
npx localxpo submit -p ios             # only list iOS builds
```

Files are never uploaded to the dashboard, so a build can only be submitted from the machine that produced it (or with `--path`).
For Android the package is read from the `.aab` itself. If it doesn't match what the profile builds now, `submit` stops instead of uploading to the wrong Play Console app.

### Machine & resource metrics

While a build or submission runs, the CLI samples the machine every 5 seconds and sends batches every 20 seconds. Sampling uses no sudo and adds no dependencies; set `LOCALXPO_NO_METRICS=1` to turn it off.

| Metric | macOS | Linux |
|---|---|---|
| CPU (whole machine), load | `os.cpus()` deltas | same |
| Memory used, as in Activity Monitor (app + wired + compressed) | `vm_stat` | `/proc/meminfo` (MemTotal − MemAvailable) |
| Swap in use | `sysctl vm.swapusage` | `/proc/meminfo` |
| Build processes: memory and CPU, grouped by name (Gradle daemon, Kotlin daemon, Xcode build service, Swift compiler, clang, node…) | `ps` (the CLI's children plus the daemons that aren't its children) | same |
| Power draw and energy (Wh) | battery telemetry from `ioreg` (`SystemLoad` on Apple silicon, on battery or charger); desktops don't report it | RAPL when readable, else battery discharge |
| Battery %, on battery or not | `ioreg` | `/sys/class/power_supply` |
| Thermal throttling | `pmset -g therm` (Intel Macs) | – |
| Free disk on the project volume | `statfs` | same |
| Machine specs | model, chip, P and E cores, RAM, disk, macOS, Xcode, Java, Node, fastlane | distro, CPU, RAM, disk, Java, Node |

The **Machine & resources** card on each build and submission page shows these as tiles and charts (CPU, memory and power, with step boundaries), plus time and resources per step and the heaviest processes. It also has plain-language insights:
- slower or faster than this machine's usual for the same project, platform and profile;
- memory pressure or swapping, and the process that used the most memory;
- heat throttling, building on battery, low disk;
- which step took the time, and whether it was compute-bound or waiting on network or disk;
- the energy used.

The CLI prints a one-line summary at the end of each run. The organization's **Machines** page compares the computers your team builds on over 30 days:
- specs and tool versions;
- builds and success rate, median Android and iOS durations;
- average CPU and memory peak;
- energy per build, and how often each machine swapped or throttled;
- which machine is fastest for each platform.

### Resource limits

On **Machines**, set limits for every machine (**Default resource limits**) or override them for one machine. Anything you leave unset falls back to the default, and the default leaves the project's own settings (`gradle.properties`, Xcode) alone. The CLI fetches the limits when a build starts and logs which ones it applied; `--no-limits` skips them for one build.

| Limit | What the CLI does |
|---|---|
| Gradle memory (GB) | `-Dorg.gradle.jvmargs=-Xmx<N>g …`, which overrides `gradle.properties`; the Kotlin daemon gets `kotlin.daemon.jvmargs=-Xmx<N/2>g` |
| Parallel workers | Gradle `--max-workers=<N>`, Xcode `-jobs <N>` |
| CPU priority: low | every build command runs under `nice -n 10`, and Gradle daemons or Xcode build services that were already running are `renice`d, so the machine stays responsive |
| Stop Gradle daemons after the build | `./gradlew --stop` when the build ends, giving their memory back |

The form shows each machine's capacity next to the fields:
- a RAM bar showing what the Gradle and Kotlin heaps take, with the recommended range;
- the cores, performance and efficiency, with how many the workers use.

Each field shows a recommended value and its sensible range, based on the specs and on what Gradle actually used in recent builds. Checks run as you type, flagging values that are too low (Java heap errors, sequential builds) or too high (more than half of RAM, more workers than cores, workers that won't fit in memory). A value that can't work on that machine blocks saving. The default limits are checked against your smallest machine.

**Live in the build view.** Above the logs, a strip refreshes every 5 seconds while the build runs: memory used, memory pressure (how full RAM is and whether swap grew in the last 2 minutes), CPU, the build processes and the largest of them, power and battery, and free disk. When the build ends it switches to peaks. **Limit this machine** opens the same form for the build's machine. Memory and worker limits apply from the next build. Low CPU priority also reaches the running build within about 30 seconds: the CLI re-reads the limits and renices its process tree.

**Use all recommended** fills in a starting point: a third of RAM for Gradle (2 to 8 GB), one worker per performance core, low priority on laptops, and stopping daemons on machines with 16 GB or less.

### Logs

- Every line is **redacted on your machine** first (known secrets such as keystore passwords and tokens, plus patterns like `password=…` and PEM blocks), then written to `~/.localxpo/logs/<build>.log` and sent in batches every second.
- If the network drops, lines stay queued. Anything still unsent at the end is saved to `~/.localxpo/pending/` and uploaded by the next `localxpo` command (or `localxpo sync`).
- The server scans incoming lines against ~30 known failure patterns (fastlane missing or too old, App Store Connect app missing, build number already used, provisioning profiles, CocoaPods, JDK version, Android SDK, keystore passwords, version code already used, Metro resolution, lockfile drift, disk full, network…). Matches appear as **What went wrong** cards on the build page and at the end of the CLI output. Add your own in `src/lib/server/issues.ts`.

## API (v1)

Bearer token (`Authorization: Bearer lx_…`) for everything; the browser session also works for `GET` requests.

```
POST  /api/v1/auth/login                 {email,password,deviceName} → {token, orgs}
GET   /api/v1/me                         GET /api/v1/orgs
GET   /api/v1/projects?org    POST /api/v1/projects {org?, …} (upsert by slug, returns config checks)
GET   /api/v1/projects/:id/env?environment=development|preview|production
GET   /api/v1/builds?org|projectId&platform&status&limit&offset
GET   /api/v1/builds/compatible?projectId&platform&fingerprint&profile
POST  /api/v1/submissions {buildId,destination}   PATCH /api/v1/submissions/:id {status,errorMessage}
POST  /api/v1/builds                     create (status in_progress)
GET   /api/v1/builds/:id      PATCH /api/v1/builds/:id {status,errorMessage,artifactPath,submitted,finishedAt,fingerprint}
PUT   /api/v1/builds/:id/steps           {key,name,position,status}
GET   /api/v1/builds/:id/logs?after=&limit=&step=   (or ?format=text to download)
POST  /api/v1/builds/:id/logs            {lines:[{seq,ts,step,stream,line}]}  idempotent on seq
GET   /api/v1/credentials?kind=apple_asc_key|google_service_account|android_keystore&projectId
POST  /api/v1/credentials                (android_keystore backup from the CLI)
```

## Not built yet

- Store status polling (TestFlight processing, review state, Play rollout) on the build timeline.
- Version / build number auto-increment (eas.json `autoIncrement` is read but not applied yet).
- OTA updates server (expo-updates protocol).
- Email invitations (today a teammate registers first, then an owner adds them).

## Credits

Built with [Claude](https://www.anthropic.com/claude) by Anthropic. UI built on [AdminCN Free](https://github.com/shadcnstudio/shadcn-nextjs-admincn-admin-template-free) by shadcn/studio (MIT).
