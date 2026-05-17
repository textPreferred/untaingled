# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager & runtime

Use **bun** for everything — package management, running TypeScript, and tests.

## Commands

```bash
bun install        # install dependencies
bun run build      # tsc compile to dist/
bun dev            # run src/index.ts
bun test           # run tests
bun lint           # oxlint
bun format         # oxfmt (fix)
bun format:check   # oxfmt (check only)
```

## TypeScript

Strict mode with additional checks: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Module system is `Preserve` / `Bundler` (bun-native). Source in `src/`, compiled output in `dist/`.

## CI pipeline

Defined in [.github/ci-pipeline.yml](.github/ci-pipeline.yml). On push/PR to `main` it runs lint, format check, test, and build in parallel (after install). All must pass for Renovate auto-merge to trigger.
