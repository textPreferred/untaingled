# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Defined in [.github/ci-pipeline.yml](.github/ci-pipeline.yml). On push/PR to `main` it runs lint, format check, test, and build in parallel (after install). All must pass for Renovate auto-merge to trigger.

## Coding Preferences

Defined in [./doc/engineering.md](./doc/engineering.md). Keep updated with explicit decisions in claude sessions.

## Domain Knowledge

Collected in [./doc/domain.md](./doc/domain.md). Keep updated with explicit decisions in claude sessions.

## Docs

Keep [./DEVELOPING.md](./DEVELOPING.md) up-to-date if scripts or tools change.
