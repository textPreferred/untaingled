# Developing

## Setup

```bash
bun install
```

## Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `bun dev`           | Build client and start dev server        |
| `bun build`         | Full production build (vite + tsc)       |
| `bun build:client`  | Build client only (vite)                 |
| `bun test`          | Run unit tests                           |
| `bun test:coverage` | Run unit tests with LCOV coverage report |
| `bun test:e2e`      | Run Playwright end-to-end tests          |
| `bun build:image`   | Build Docker image                       |
| `bun start:image`   | Run Docker image on port 3000            |
| `bun db:start`      | Start local Postgres container           |
| `bun db:stop`       | Stop and remove local Postgres container |
| `bun lint`          | Lint and auto-fix with oxlint            |
| `bun lint:check`    | Lint check only (no fixes)               |
| `bun format`        | Format and auto-fix with oxfmt           |
| `bun format:check`  | Format check only (no fixes)             |

## Database

`DATABASE_URL` must be set for `bun dev` and `bun test:e2e`. Start a local Postgres container:

```bash
bun db:start
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/untaingled
```

Stop it with `bun db:stop`.

Migrations run automatically on server start via `db.migrate.latest()`.

## Northflank deployment

1. Create a Northflank project and add a **PostgreSQL addon** (free tier includes one).
2. Create a service pointing at the GHCR image published by CI (`ghcr.io/<owner>/untaingled:latest`).
3. Set the `DATABASE_URL` environment variable to the addon's connection string (available in the addon's connection details page).
4. No persistent volume is required.

Internal addon connections on Northflank do not need SSL. If connecting from outside, append `?sslmode=require` to the URL.

## Git hooks

[Lefthook](https://lefthook.dev) runs on `pre-commit`: auto-fixes lint and formatting issues and stages the changes.

## CI

On push/PR to `main`, the pipeline runs `lint:check`, `format:check`, `test`, and `build` in parallel. All must pass for Renovate auto-merge to trigger.
