# Result UGC

Result's internal Creator 360 workspace. It joins Discord identity and access, Launchpoint or manually verified signing relationships, Viral-tracked social accounts and videos, and Result-owned management context into one canonical creator profile.

## Repository layout

- `apps/web` — Next.js dashboard deployed on Vercel.
- `apps/bot` — Discord operations bot deployed on the Hetzner VM.
- `packages/domain` — provider contracts and shared lifecycle, tracking, and operation types.
- `packages/db` — Drizzle schema, migrations, and the pooled Neon connection shared by the portal and bot.
- `DESIGN.md` — canonical dark-theme design system and implementation rules.
- `PRODUCT_PLAN.md` — two-sided product architecture, screens, integrations, and delivery sequence.

The web app and bot stay independently deployable while sharing Neon Postgres as their source of truth. Discord remains authoritative for guild membership, roles, and channels. Result remains authoritative for lifecycle, notes, provider mappings, and management state.

## What Phase 1 includes

- Manager overview with current Viral metrics, performance charts, exceptions, and sync freshness.
- Creator roster with Requests, Active, Watch, and Offboarded views.
- Creator 360 profiles with Discord, signing relationships, accounts, videos, notes, and audit history.
- Dense sortable Accounts and Videos workspaces with configurable columns and pagination.
- Native Viral warmup/unpaid exclusions plus a separate Result audit event.
- Discord OAuth access restricted to the Result guild and configured staff roles.
- Durable, idempotent Discord operation queue processed by the Hetzner bot.
- Automatic Launchpoint relationship synchronization; SideShift is deliberately manual until an API adapter is available.
- `organization_id` on all stored records so future customer workspaces do not require a schema redesign.

## Local development

Requires Node.js 22+ and pnpm.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/bot/.env.example apps/bot/.env
pnpm db:migrate
pnpm dev:web
```

In a second terminal, run:

```bash
pnpm dev:bot
```

## Validation

```bash
pnpm check
pnpm test
pnpm build
```

Secrets and bot runtime state are intentionally excluded from Git. Production bot credentials remain on Hetzner; Vercel environment variables belong in the Vercel project.

## Production configuration

### Vercel portal

The project root is `apps/web`. Configure the variables listed in `apps/web/.env.example`. The Discord OAuth redirect is:

```text
https://result-ugc-orcin.vercel.app/api/auth/discord/callback
```

The protected `/api/cron/viral-sync` endpoint runs the provider pipeline: it imports the complete Launchpoint creator/signing directory when `LAUNCHPOINT_API_KEY` is configured, adds Launchpoint-discovered social identities to Viral tracking, refreshes Viral account/video snapshots, and rebuilds canonical creator suggestions. Because Vercel Hobby only permits daily native cron schedules, the always-on Hetzner bot calls it every 15 minutes using `RESULT_PORTAL_URL` and `RESULT_PORTAL_CRON_SECRET`. Failed synchronizations retain the last successful values and surface a stale or failed state; they are never converted into zeroes.

### Hetzner bot

Copy the current release to the VM, add the same pooled `DATABASE_URL`, and enable the **Server Members Intent** in the Discord Developer Portal. On the first database-backed start, the bot:

1. Writes an immutable timestamped backup of `.data/state.json`.
2. Imports legacy creator IDs, Launchpoint mappings, notes, next steps, and statuses.
3. Reconciles the whole guild and then repeats reconciliation every ten minutes.
4. Processes queued portal operations without requiring Message Content intent.
5. Triggers the protected Viral snapshot endpoint every 15 minutes.

Roll out with portal actions restricted to Admins first. Once reconciliation and operation recovery have been observed in production, add the UGC Manager role IDs.
