# Contributing

Thanks for your interest in improving Untaingled! This guide covers how to get
set up, the conventions we follow, and how to get a change merged.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

You need [Bun](https://bun.sh) and Docker (for a local PostgreSQL container).

```bash
bun install
cp .env.example .env   # fill in Auth0 credentials and a random SESSION_SECRET
bun dev                # builds the client and serves on http://localhost:3000
```

[DEVELOPING.md](DEVELOPING.md) has the full command reference, the local
database workflow, and third-party service setup.

## Development workflow

- **Test-driven.** Follow red-green-refactor and commit the failing (red) test.
  Bug fixes and features both start with a test that demonstrates the change.
- **Frontend changes need a regression test** (Playwright E2E) covering the
  behavior you touched.
- **One logical change per pull request.** Keep PRs focused and reviewable.
- **Leave code better than you found it** (Boy Scout Rule), but keep unrelated
  refactors out of feature PRs.

The full coding conventions live in [doc/engineering.md](doc/engineering.md) —
notably: prefer simple over clever, don't abbreviate names, prefer composition
over inheritance, and don't mix abstraction levels within a function.

## Before you open a PR

Run the same checks CI runs — all must pass:

```bash
bun lint:check
bun format:check
bun test
bun run build
bun test:e2e
```

`bun lint` and `bun format` auto-fix most issues. A Lefthook `pre-commit` hook
also auto-fixes lint and formatting and stages the result.

## Commits and pull requests

- Write commit messages and PR descriptions in clear, plain English.
- Describe **what** changed and **why**, not just how.
- Open the PR against `main`. CI (lint, format, test, build, E2E, Trivy scan)
  must be green before merge.

## Reporting bugs and requesting features

Use the GitHub issue templates. For anything security-related, **do not open a
public issue** — follow [SECURITY.md](SECURITY.md) instead.

## Questions

Open a GitHub Discussion or issue. We're happy to help you land your first
contribution.
