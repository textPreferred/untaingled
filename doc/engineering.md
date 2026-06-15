# Engineering

## Key Concepts

### Encryption at Rest

All event text is encrypted under a per-user AES-GCM key before being written to the database. The key is derived from the user's passphrase (scrypt) server-side; the server holds the plaintext key in memory for the session and does the encrypt/decrypt. This protects against a stolen database, not against the server itself — it is not zero-knowledge or end-to-end. Losing the passphrase means permanent data loss.

### Per-User Isolation

Every user's events are siloed. No cross-user access.

### Date Hierarchy

Date events form a tree: year 2026 contains months, which contain days. Assigning a date to an event auto-creates and links the full hierarchy.

### Graph Structure

Events form a directed acyclic graph where edges represent "happened while" relationships. Users can visualize this as a tree-like graph.

## Code Guidelines

- Follow Red-Green-Refactor TDD. Do commit the red test.
- Existing data must not be lost or get corrupted. Do use migrations to make sure.
- Prefer simple over clever.
- Do not abbreviate names.
- Use bun's `bun.lock` as the only lockfile. Do not commit foreign lockfiles (pnpm/npm/yarn) — a stray one misleads Renovate into updating it instead of `bun.lock`, breaking CI.
- Do little refactorings as we go along, leaving code better than before (Boy Scout Rule).
- Prefer composition over inheritance. Avoid inheritance.
- Don't mix abstractions in functions. A function either consists of named function calls, or runs lower level operations. Never both.
