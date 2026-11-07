# localxpo

Expo builds on your own machines, tracked in one dashboard.

The `localxpo` CLI builds, signs and submits iOS and Android apps with fastlane on your Mac or PC. This repo is the dashboard it reports to: live logs, steps, machine metrics, store credentials, submissions and a shared history. Builds never run on the server, and binaries never leave the machine.

```
 your Mac / PC                                   dashboard (this repo)
 npx localxpo build ── logs, steps, metrics ──▶  Next.js 16 + Postgres
 npx localxpo agent ◀── jobs, cancel, keys ───   self-hosted or localxpo Cloud
```

## Quick start

```bash
pnpm install
pnpm dev                     # http://localhost:3000, register the first account
```

In an Expo project:

```bash
npx localxpo link            # sign in, connect the project, set up store credentials
npx localxpo build -p ios --profile production --submit
npx localxpo agent           # optional: start builds from the dashboard
```

No database to install: without `DATABASE_URL` the dashboard uses an embedded Postgres (PGlite) in `./data`.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router, server actions), React 19, Tailwind 4, shadcn/ui |
| Data | Postgres: `pg` with `DATABASE_URL`, PGlite otherwise. Migrations in `src/lib/server/migrations.ts` run on start |
| Auth | Email + password (scrypt), session cookies, API tokens for the CLI |
| Secrets | Store keys encrypted with AES-256-GCM (`LOCALXPO_SECRET` or `data/.secret`) |

```
src/app/(pages)      dashboard pages          src/lib/server     data access, auth, plans
src/app/api/v1       REST API for the CLI     src/lib/actions    server actions
src/views            page components          scripts/           maintenance scripts
```

The CLI (`cli/`) is developed here but gitignored and published to npm as `localxpo`. The CLI commands, the build pipeline, credentials, metrics and the API are documented in [docs/reference.md](docs/reference.md).

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon, Supabase, Railway…). Unset: embedded Postgres |
| `LOCALXPO_SECRET` | Encryption key for store credentials. Set and back it up in production |
| `NEXT_PUBLIC_APP_URL` | Public URL, used in CLI commands and links |

## localxpo Cloud

Prefer to work online without running a server? **localxpo Cloud** hosts the dashboard for you: sign up, run `npx localxpo link`, and your builds report there. Builds still run on your own machines.

Cloud has a free plan and a **Pro** plan for growing teams: more members and machines, longer history, and upcoming features such as install links for testers, notifications, GitHub integration and scheduled builds.

## Scripts

| | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run, build and serve the dashboard |
| `pnpm lint`, `pnpm check-types` | ESLint and TypeScript |
| `pnpm db:import <file>` | Copy a pre-Postgres SQLite database into `DATABASE_URL` |
| `pnpm release:cli` | Build and publish the CLI to npm |

## License and credits

localxpo is open source under the [MIT license](LICENSE.md).

- Built with [Claude](https://www.anthropic.com/claude) by Anthropic.
- UI based on [AdminCN Free](https://github.com/shadcnstudio/shadcn-nextjs-admincn-admin-template-free) by shadcn/studio (MIT).
