# syntax=docker/dockerfile:1
# Image digests are pinned and kept current by Renovate.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM docker.io/oven/bun:slim@sha256:621f249399228db47cf34611ee662585e77e015250ed29d5d0932b2d3282f0b0 AS builder

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM docker.io/oven/bun:slim@sha256:621f249399228db47cf34611ee662585e77e015250ed29d5d0932b2d3282f0b0 AS runtime

WORKDIR /app

# Copy production node_modules (includes native sqlite3 bindings compiled above)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled server and Vite client assets
COPY --from=builder /app/dist ./dist

# Bun runs TypeScript directly at runtime; migrations are also .ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Mount a persistent volume at /data for the SQLite database file
ENV USERS_DB_PATH=/data/users.db

VOLUME ["/data"]

ENTRYPOINT ["bun", "src/index.ts"]
