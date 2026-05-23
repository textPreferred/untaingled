# syntax=docker/dockerfile:1
# Image digests are pinned and kept current by Renovate.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev@sha256:8fdce98075c1bf63ef1f28b2b1be1061378bf9b06435b44488a8604fadfacc83 AS builder

USER root
RUN wget -qO /tmp/bun.zip https://github.com/oven-sh/bun/releases/download/bun-v1.3.6/bun-linux-x64.zip \
    && echo "9ba98d2134550d6690875b23a4f5c48e74b7cb267e8cc1b8f52605921c6c11ef  /tmp/bun.zip" | sha256sum -c - \
    && unzip /tmp/bun.zip -d /tmp \
    && mv /tmp/bun-linux-x64/bun /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip /tmp/bun-linux-x64

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

# Copy compiled server, Vite client assets, and migrations
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Mount a persistent volume at /data for the SQLite database file
ENV USERS_DB_PATH=/data/users.db

VOLUME ["/data"]

ENTRYPOINT ["bun", "dist/index.js"]
