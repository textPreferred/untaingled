# syntax=docker/dockerfile:1
# Chainguard image digests are pinned and kept current by Renovate.

# ── Build stage ───────────────────────────────────────────────────────────────
# cgr.dev/chainguard/bun:latest-dev includes shell + build tools for native modules
FROM cgr.dev/chainguard/bun:latest-dev AS builder

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# cgr.dev/chainguard/bun:latest is the minimal, distroless-style runtime image
FROM cgr.dev/chainguard/bun:latest AS runtime

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
