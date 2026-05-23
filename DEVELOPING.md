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
| `bun lint`          | Lint and auto-fix with oxlint            |
| `bun lint:check`    | Lint check only (no fixes)               |
| `bun format`        | Format and auto-fix with oxfmt           |
| `bun format:check`  | Format check only (no fixes)             |

## Git hooks

[Lefthook](https://lefthook.dev) runs on `pre-commit`: auto-fixes lint and formatting issues and stages the changes.

## CI

On push/PR to `main`, the pipeline runs `lint:check`, `format:check`, `test`, and `build` in parallel. All must pass for Renovate auto-merge to trigger.
