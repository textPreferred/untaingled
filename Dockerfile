# syntax=docker/dockerfile:1
# Image digests are pinned and kept current by Renovate.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node@sha256:30bac16e19a580ed7feb991876e89d45f96eead87518df4bce46e597336c6a18 AS builder

USER root
ADD --checksum=sha256:9ba98d2134550d6690875b23a4f5c48e74b7cb267e8cc1b8f52605921c6c11ef \
    https://github.com/oven-sh/bun/releases/download/bun-v1.3.6/bun-linux-x64.zip /tmp/bun.zip
WORKDIR /tmp
RUN unzip bun.zip \
    && mkdir -p /usr/local/bin \
    && mv bun-linux-x64/bun /usr/local/bin/bun \
    && rm -rf bun.zip bun-linux-x64

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY src/ ./src/
COPY migrations/ ./migrations/
COPY index.html tsconfig.json tsconfig.client.json tsconfig.migrations.json vite.config.ts ./
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node@sha256:30bac16e19a580ed7feb991876e89d45f96eead87518df4bce46e597336c6a18 AS runtime

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --ignore-scripts --production

# Copy compiled server, Vite client assets, and migrations
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["bun", "--preload", "./dist/instrumentation.js", "./dist/index.js"]
