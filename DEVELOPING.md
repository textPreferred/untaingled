# Developing

## Setup

```bash
bun install
cp .env.example .env  # then edit .env with your credentials
```

## Scripts

| Command             | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `bun dev`           | Build client and start dev server                                  |
| `bun build`         | Full production build (vite + tsc)                                 |
| `bun build:client`  | Build client only (vite)                                           |
| `bun test`          | Run unit tests                                                     |
| `bun test:coverage` | Run unit tests with LCOV coverage report                           |
| `bun test:e2e`      | Run Playwright E2E tests (starts and stops Postgres automatically) |
| `bun test:e2e:ci`   | Run Playwright E2E tests without managing Postgres (used in CI)    |
| `bun build:image`   | Build Docker image                                                 |
| `bun start:image`   | Run Docker image on port 3000                                      |
| `bun db:start`      | Start local Postgres container (for `bun dev`)                     |
| `bun db:stop`       | Stop and remove local Postgres container                           |
| `bun lint`          | Lint and auto-fix with oxlint                                      |
| `bun lint:check`    | Lint check only (no fixes)                                         |
| `bun format`        | Format and auto-fix with oxfmt                                     |
| `bun format:check`  | Format check only (no fixes)                                       |

## Environment

Copy `.env.example` to `.env` and fill in your credentials. Bun loads `.env` automatically.

## Database

`bun dev` starts a local Postgres container automatically if one isn't already running. Use `bun db:stop` to tear it down.

`bun test:e2e` manages its own container — no setup needed.

Migrations run automatically on server start via `db.migrate.latest()`.

## Northflank deployment

1. Create a Northflank project and add a **PostgreSQL addon** (free tier includes one).
2. Create a service pointing at the GHCR image published by CI (`ghcr.io/<owner>/untaingled:latest`).
3. Set the `DATABASE_URL` environment variable to the addon's connection string (available in the addon's connection details page).
4. No persistent volume is required.

Internal addon connections on Northflank do not need SSL. If connecting from outside, append `?sslmode=require` to the URL.

## Third-party services

| Service                              | Environments | Purpose                                                         |
| ------------------------------------ | ------------ | --------------------------------------------------------------- |
| **Auth0**                            | Dev + Prod   | OIDC identity provider (authentication)                         |
| **PostgreSQL 17**                    | Dev + Prod   | Primary data store (via Knex.js)                                |
| **Northflank**                       | Prod         | PaaS hosting + managed PostgreSQL addon                         |
| **GitHub Container Registry (GHCR)** | CI + Prod    | Docker image hosting                                            |
| **GitHub Actions**                   | CI           | Lint, test, build, and deploy pipeline                          |
| **Trivy**                            | CI           | Container and filesystem vulnerability scanning                 |
| **Sigstore/Cosign**                  | CI           | Keyless container image signing                                 |
| **Playwright**                       | Dev + CI     | End-to-end testing                                              |
| **Honeycomb**                        | Prod (opt.)  | Distributed tracing via OpenTelemetry (set `HONEYCOMB_API_KEY`) |

## Git hooks

[Lefthook](https://lefthook.dev) runs on `pre-commit`: auto-fixes lint and formatting issues and stages the changes.

## CI

On push/PR to `main`, the pipeline runs `lint:check`, `format:check`, `test`, and `build` in parallel. All must pass for Renovate auto-merge to trigger.
