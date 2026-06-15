# Untaingled

[![CircleCI](https://circleci.com/gh/textPreferred/untaingled/tree/main.svg?style=shield)](https://app.circleci.com/pipelines/gh/textPreferred/untaingled?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A personal-history tracker with per-user encryption at rest. Record events from your life, link them to dates or to other events they happened during, and explore them as a list or an interactive graph.

**Data is encrypted at rest under a per-user key.** Every event title and description is stored encrypted with a per-user AES-GCM key, derived from your encryption passphrase via scrypt. The passphrase is sent to the server, which derives the key and encrypts/decrypts on your behalf — so this protects against a stolen database, not against the server itself. Losing the passphrase means losing the data permanently.

## Features

- Events can be rooted in other events ("took place while …") or in auto-created date nodes (year / year-month / year-month-day)
- List view and SVG graph view of the event tree

## Development

For details, see [DEVELOPING.md](DEVELOPING.md).

### Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Runtime  | [Bun](https://bun.sh)                        |
| Server   | [Hono](https://hono.dev)                     |
| Client   | [Vue 3](https://vuejs.org) + Vite            |
| Database | PostgreSQL 17 via [Knex](https://knexjs.org) |
| Auth     | Auth0 (OIDC) + `openid-client`               |
| Crypto   | `node:crypto` (scrypt, AES-GCM)              |

### Quick start

```bash
git clone https://github.com/textPreferred/untaingled.git
cd untaingled
bun install
cp .env.example .env   # fill in Auth0 credentials and a random SESSION_SECRET
bun dev                # auto-starts a local Postgres container, builds client, serves on :3000
```

See [DEVELOPING.md](DEVELOPING.md) for the full command reference, deployment guide, and third-party service setup.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the
development workflow and conventions, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
for community expectations. To report a security issue, follow
[SECURITY.md](SECURITY.md) — please don't open a public issue.

## License

[MIT](LICENSE)
