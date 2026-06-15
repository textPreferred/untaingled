# Security Policy

## Supported versions

Untaingled is developed on `main`, and the latest published Docker image
(`ghcr.io/textPreferred/untaingled:latest`) tracks `main`. Security fixes are applied
to `main`; there are no separate maintenance branches.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report privately via GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
use the **Report a vulnerability** button under the repository's **Security**
tab.

Please include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version, commit, or deployment, and
- any suggested remediation.

## What to expect

- **Acknowledgement** within 5 business days.
- An assessment and, where confirmed, a plan and target timeline for a fix.
- Coordinated disclosure: we will agree on a public disclosure date with you and
  credit you in the advisory unless you prefer to remain anonymous.

## Scope

This project handles authentication (Auth0/OIDC) and per-user encryption of
event content at rest. Reports about authentication, session handling,
cross-user data access, or the encryption ceremony are especially valued.

Note on the encryption model: event content is encrypted at rest under a
per-user key that the **server** derives from the user's passphrase and holds in
memory for the session. This protects against a stolen database, not against a
compromised or malicious server — it is not zero-knowledge or end-to-end. Please
keep this threat model in mind when assessing impact.
