# syntax=docker/dockerfile:1

# ---- base: pin node + pnpm to match mise.toml ----
FROM node:24.14.1-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.4.0 --activate
WORKDIR /app

# ---- deps: install with the lockfile for reproducibility ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/exchanges/package.json packages/exchanges/package.json
COPY packages/services/package.json packages/services/package.json
# better-sqlite3 needs a toolchain to build its native addon.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile

# ---- build: compile the web dashboard ----
FROM deps AS build
COPY . .
RUN pnpm --filter @gridbot/web build

# ---- runtime: API server (source-run via tsx) + built web assets ----
FROM build AS runtime
ENV NODE_ENV=production
ENV GRIDBOT_PORT=8787
ENV GRIDBOT_DB_PATH=/data/gridbot.sqlite
VOLUME ["/data"]
EXPOSE 8787
# The API runs via tsx (source packages resolve directly); web assets are
# served by a separate static host or the vite preview in compose.
CMD ["pnpm", "--filter", "@gridbot/api", "start"]
