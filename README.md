# Untaingled

A personal-history tracker with zero-knowledge end-to-end encryption. Record events from your life, link them to dates or to other events they happened during, and explore them as a list or an interactive graph.

**The server never sees your data.** Every event title and description is encrypted client-side with a per-user key derived from your encryption passphrase before it is stored in the database. Losing the passphrase means losing the data permanently.

## Features

- Auth via Auth0 (OIDC/PKCE); no passwords stored
- Separate encryption passphrase derived via scrypt into a per-user AES-GCM key
- Events can be rooted in other events ("took place while …") or in auto-created date nodes (year / year-month / year-month-day)
- List view and SVG graph view of the event tree
- CSRF protection, `HttpOnly`/`SameSite=Lax` session cookies
- Playwright E2E test suite; CircleCI pipeline with Trivy security scan
- Docker image published to GHCR on every merge to `main`

## Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Runtime  | [Bun](https://bun.sh)                        |
| Server   | [Hono](https://hono.dev)                     |
| Client   | [Vue 3](https://vuejs.org) + Vite            |
| Database | PostgreSQL 17 via [Knex](https://knexjs.org) |
| Auth     | Auth0 (OIDC) + `openid-client`               |
| Crypto   | Web Crypto API (scrypt, AES-GCM)             |

## Quick start

```bash
bun install
cp .env.example .env   # fill in Auth0 credentials and a random SESSION_SECRET
bun db:start           # starts a local Postgres container
bun dev                # builds client and starts server on :3000
```

See [DEVELOPING.md](DEVELOPING.md) for the full command reference, deployment guide, and third-party service setup.

## License

[MIT](LICENSE)
