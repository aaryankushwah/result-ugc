# Result Clanker — Discord worker.
# Built from the repository root so the pnpm workspace packages resolve:
#   flyctl deploy --config apps/bot/fly.toml --dockerfile apps/bot/Dockerfile
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable

# Manifests first so dependency installs cache independently of source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY apps/bot/package.json apps/bot/
RUN pnpm install --frozen-lockfile --filter @result/discord-bot...

COPY packages/domain packages/domain
COPY packages/db packages/db
COPY apps/bot apps/bot
RUN pnpm --filter @result/domain build \
 && pnpm --filter @result/db build \
 && pnpm --filter @result/discord-bot build

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/bot
# The worker holds an outbound gateway connection; it exposes no ports.
CMD ["node", "dist/index.js"]
