# Result UGC

Result's internal UGC workspace: one dashboard for content tracking, reference-video intelligence, briefs, and creator operations.

## Repository layout

- `apps/web` — Next.js dashboard deployed on Vercel.
- `apps/bot` — Discord operations bot deployed on the Hetzner VM.
- `packages` — shared data contracts and utilities as the product grows.
- `DESIGN.md` — canonical dark-theme design system and implementation rules.
- `PRODUCT_PLAN.md` — two-sided product architecture, screens, integrations, and delivery sequence.

The web app and bot stay independently deployable while sharing one source of truth.

## Local development

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev:web
```

In a second terminal, configure `apps/bot/.env` from its example and run:

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
