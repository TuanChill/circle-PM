# syntax=docker/dockerfile:1
# Shared multi-stage build for the NestJS services (auth-service, user-service,
# project-service, notification-service). Build with:
#   docker build -f .docker/compose/nodejs/Dockerfile --build-arg SERVICE=auth-service .
# Uses `turbo prune` so each service's image only carries the workspace
# packages it actually depends on. BuildKit cache mounts persist the pnpm
# store and turbo's task cache across builds (and across the 4 services),
# so re-running `docker compose build` after the first time is fast, and
# @app/common/@app/core only get compiled once for all Nest services.

FROM node:22.15.0-alpine3.21 AS base
ENV COREPACK_HOME=/opt/corepack
RUN mkdir -p "$COREPACK_HOME" \
    && chmod 755 "$COREPACK_HOME"
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
RUN pnpm config set store-dir /pnpm-store
ENV TURBO_CACHE_DIR=/turbo-cache

FROM base AS pruner
ARG SERVICE
WORKDIR /work
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm dlx turbo@2.10.12 prune ${SERVICE} --docker
# turbo prune only copies workspace package files into out/full, not root
# config files like tsconfig.json that libs/apps `extends` — carry it over
# so the extends chain resolves inside the pruned tree.
RUN cp tsconfig.json out/full/tsconfig.json

FROM base AS installer
ARG SERVICE
WORKDIR /work
COPY --from=pruner /work/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile
COPY --from=pruner /work/out/full/ .
RUN --mount=type=cache,id=turbo-cache,target=/turbo-cache \
    pnpm exec turbo run build --filter=${SERVICE}

FROM base AS runner
ARG SERVICE
ENV SERVICE=${SERVICE}
ENV NODE_ENV=production
WORKDIR /work
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer --chown=nestjs:nodejs /work .
USER nestjs
CMD node apps/${SERVICE}/dist/main.js
