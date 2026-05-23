# syntax=docker/dockerfile:1
# Image digests are pinned and kept current by Renovate.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev@sha256:393a2b14516c6084d10f6393380e148de08e16e35e7c92aa06009faf6818b388 AS builder

USER root
RUN npm install -g bun

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest@sha256:3e212e37f83e078397dd8431964a4d703b5ecba9ed508c2748ad24a11930a746 AS runtime

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

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
