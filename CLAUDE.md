# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Language

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:

    * Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
    * Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
    * Pattern: [thing] [action] [reason]. [next step].
    * Not: "Sure! I'd be happy to help you with that."
    * Yes: "Bug in auth middleware. Fix:"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.

# Production Priorities

User data must be preserved over migrations and code / architecture changes.

# Project

## Package manager & runtime

Use **bun** for everything — package management, running TypeScript, and tests.

Deployment works via compiled JavaScript.

## Commands

```bash
bun install        # install dependencies
bun run build      # tsc compile to dist/
bun dev            # run src/index.ts
bun test           # run tests
bun lint           # oxlint (fix)
bun lint:check     # oxlint (check only)
bun format         # oxfmt (fix)
bun format:check   # oxfmt (check only)
```

## TypeScript

Strict mode with additional checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Module system is `Preserve` / `Bundler` (bun-native). Source in `src/`, compiled output in `dist/`.

## CI pipeline

Defined in [.circleci/config.yml](.circleci/config.yml) (CircleCI). On push/PR to `main`, after `install` it runs lint, format check, test, build, e2e, and a Trivy security scan in parallel; `docker-build`/`docker-publish` handle the image (publish on `main` only). All must pass for Renovate auto-merge to trigger.

The old GitHub Actions pipeline is retired — see [.github/workflows/ci-pipeline.yml.disabled](.github/workflows/ci-pipeline.yml.disabled).

## Coding Preferences

Red/Green/Refactor TDD.

More details defined in [./doc/engineering.md](./doc/engineering.md). Keep updated with explicit decisions in claude sessions.

## Domain Knowledge

Collected in [./doc/domain.md](./doc/domain.md). Keep updated with explicit decisions in claude sessions.

## Environment

`DATABASE_URL` must be set to a PostgreSQL connection string before running `bun dev` or `bun test:e2e`. See [DEVELOPING.md](./DEVELOPING.md) for a one-liner to start a local Postgres container.

## Docs

Keep [./DEVELOPING.md](./DEVELOPING.md) up-to-date if scripts or tools change.
