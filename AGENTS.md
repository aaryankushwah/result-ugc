# Result Repository Guide

This file is the operating contract for coding agents working in this repository. Read it before changing code. It takes precedence over any broader guide inherited from a parent directory. More specific `AGENTS.md` files apply in their own directories; `apps/web/AGENTS.md` contains the Next.js-version rules and must remain intact.

## Stack

This repository does **not** use Result Backend. There is no `@resultdev/sdk`, no `npx @resultdev/cli`, no `BACKEND_ADMIN_KEY`, and no `NEXT_PUBLIC_BACKEND_URL`. A home-level `~/AGENTS.md` describes that platform for other projects; it does not apply here. Ignore it in this repository.

What this repository actually runs on:

- **Database:** Neon Postgres, reached through Drizzle and a pooled connection in `packages/db`. Schema changes go through `packages/db/src/schema.ts` and `pnpm db:generate` — see *Database and migration discipline* below.
- **Portal:** Next.js in `apps/web`, deployed on Vercel, served locally on **port 3000** by `pnpm dev:web`.
- **Bot:** the Discord worker in `apps/bot`, deployed on Hetzner, run locally by `pnpm dev:bot`. The user refers to it as **Result Clanker**.
- **Package manager:** pnpm workspaces, Node 22+.

Verification commands, all from the repository root:

```bash
pnpm check     # type/lint across domain, db, web, bot
pnpm test      # vitest across web and bot
pnpm verify    # check + test + production builds
```

## Product goal

Result is the canonical internal workspace for every UGC creator. A creator profile joins:

- Result-owned lifecycle, manager, notes, next step, and audit history
- Discord identity, guild membership, roles, and private channel
- signing relationships from Launchpoint, SideShift, and future providers
- social accounts, videos, exclusions, and performance snapshots from Viral

Do not create parallel creator models. Features must attach to the canonical `creators.id` and remain scoped by `organization_id`.

## Source-of-truth boundaries

- **Result/Postgres:** canonical creator, lifecycle, notes, manager, next step, confirmed mappings, operation queue, and audit history.
- **Discord:** actual guild membership, roles, and channels. Direct Discord changes are observed; do not silently reverse them.
- **Launchpoint:** Launchpoint creator identity, programs, contracts, and relationship state. It is the first API-synchronized signing provider.
- **SideShift:** manual, explicitly labelled verification until a real adapter is connected. Never scrape or fabricate provider state.
- **Viral:** tracked social accounts, videos, metrics, and native included/excluded state. Result stores snapshots and its own audit events.

Provider failures must preserve the last successful snapshot and mark it stale or failed. Never turn missing or failed provider data into zero.

## Repository map

- `apps/web` — Next.js manager portal and HTTP synchronization endpoint; deployed on Vercel.
- `apps/bot` — Discord worker and reconciliation loop; deployed on Hetzner.
- `packages/domain` — shared provider contracts and business types.
- `packages/db` — Drizzle schema, migrations, pooled Neon connection, and cross-service reconciliation.
- `DESIGN.md` — visual system. Use sharp shadcn surfaces, zero-radius cards, Result typography rules, and restrained dither-kit accents.
- `PRODUCT_PLAN.md` — product scope and delivery sequence.

Keep provider-neutral rules in `packages/domain`, shared persistence/reconciliation in `packages/db`, browser-facing orchestration in `apps/web`, and Discord gateway behavior in `apps/bot`.

## Working rules

1. Inspect the existing path before editing it. Preserve unrelated user changes.
2. Prefer small, typed changes over duplicated abstractions.
3. Keep all queries organization-scoped. A query missing `organization_id` is a data-isolation bug unless it is intentionally global and documented.
4. Store provider IDs separately from display names and usernames. Names are matching hints, not durable identity.
5. Exact automatic matches must be unique. Ambiguous matches become manager-review suggestions; never guess.
6. Confirmed account mappings cannot be overwritten by a background synchronization.
7. Every manager-visible mutation needs actor, timestamp, and an audit event.
8. Discord operations must be durable, idempotent, retryable, and visibly queued. The portal must not claim success before the bot confirms it.
9. Do not perform provider calls in page rendering. Pages read snapshots; background jobs refresh them.
10. Invalidate the `result-portal-data` cache after successful mutations or reconciliation. Do not add uncached duplicate portal queries.
11. Creator, account, and video rows should deep-link to their canonical detail or external source where available.
12. Never commit `.env*`, API keys, Discord tokens, database URLs, session secrets, runtime state, or provider payload dumps containing personal data.

## Database and migration discipline

- Change schema in `packages/db/src/schema.ts`, then generate a Drizzle migration with `pnpm db:generate`.
- Review generated SQL before applying it. Migrations must be forward-safe and preserve existing creator mappings.
- New records require `organization_id`; provider-owned records also require provider/external IDs and freshness metadata.
- Prefer upserts keyed by organization + provider identity. Synchronization must be safe to run repeatedly.
- Backfill nullable columns before making them required.
- Do not edit an already-applied migration. Add a new one.

## Integration invariants

### Discord

- `GuildMembers` and `Guilds` events are sufficient for Phase 1; do not request Message Content intent.
- Reconcile the complete guild at startup and on schedule.
- An accidental role removal changes Discord access state; it does not delete or offboard the creator.
- Offboarding preserves channel history and records the reason.

### Launchpoint

- Import the full creator/contracts/posts directory, not only pre-existing Result mappings.
- One Launchpoint person maps to one canonical Result creator; all of that person's contract relationships remain in provider data.
- Social/profile URLs may produce account suggestions, but manager confirmation is required before ownership is final.

### Viral

- Result creators remain canonical even if Viral has no creator objects.
- Synchronize tracked accounts and videos in batches; avoid serial provider/database loops.
- Excluded videos stay visible in the excluded view and are omitted from Result performance totals.
- Native Viral exclusion/restoration and Result audit logging must succeed as one user-visible operation or report a clear failure.

## Performance expectations

- Normal cached workspace navigation should remain below 300 ms locally against the configured Neon database.
- The initial portal read is cacheable for 30 seconds and invalidated after writes.
- Avoid N+1 database queries, sequential bulk upserts, and provider requests inside React render paths.
- Add loading, empty, stale, and provider-error states; never block an entire page because one integration is down.

## Tests

Every behavior change requires the smallest useful automated test. A successful build alone is not a test.

Required coverage by change type:

- **Domain/reconciliation:** identity normalization, unique exact matching, ambiguous matching, confirmed-link preservation, and idempotent repeated synchronization.
- **Provider adapters:** success, empty response, pagination, stale data, rate limit/error, missing external IDs, and relationship-state derivation.
- **Discord:** permissions, direct role/channel changes, queue idempotency, retry after downtime, and offboarding preservation.
- **API mutations:** authentication/authorization, organization isolation, validation, audit creation, and cache invalidation.
- **Tables/navigation:** creator/account/video links, URL-persisted filters, keyboard behavior, empty states, and destructive-action confirmation.

Place bot tests in `apps/bot/tests`. When adding testable web or database behavior, add the appropriate test runner to that package rather than hiding the logic in an untested page component.

Before committing, run:

```bash
pnpm verify
git diff --check
```

`pnpm verify` runs repository type/lint checks, automated tests, and production builds. Existing warnings may be documented, but new warnings should be fixed.

For integration or UI changes, also smoke-test the affected flow on localhost. At minimum verify login, `/overview`, `/creators`, one creator profile, `/accounts`, `/videos`, and `/integrations`. Never run destructive tests against production creators.

## Completion checklist

- The canonical creator record remains the single internal identity.
- Organization isolation and permission boundaries are preserved.
- Provider errors retain last-known-good data.
- The change has automated coverage proportional to its risk.
- `pnpm verify` and `git diff --check` pass.
- Relevant localhost flows were exercised.
- No secret, personal-data dump, or runtime state is staged.
- Documentation and `.env.example` are updated when configuration changes.
- The commit message states the user-visible outcome.

