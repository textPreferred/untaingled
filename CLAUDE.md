# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager

Use **pnpm** for all dependency management.

## Commands

```bash
pnpm install       # install dependencies
pnpm build         # tsc compile to dist/
pnpm dev           # run src/index.ts via ts-node
pnpm test          # run tests once (vitest)
pnpm test:watch    # run tests in watch mode
pnpm lint          # oxlint
pnpm format        # oxfmt (fix)
pnpm format:check  # oxfmt (check only)
```

## TypeScript

Strict mode with additional checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Module system is `NodeNext` (ESM). Source in `src/`, compiled output in `dist/`.

## CI pipeline

Defined in [.github/ci-pipeline.yml](.github/ci-pipeline.yml). On push/PR to `main` it runs lint, format check, test, and build in parallel (after install). All must pass for Renovate auto-merge to trigger.
