# Domain Model

## Core Entities

### User

A person identified by Auth0 (OIDC). Users manage their own encryption passphrase, separate from authentication.

### Event

A titled occurrence (optionally with description). The core unit of the system. Users create and link events to build a personal history.

**Event kinds:**

- **Regular events**: User-created, editable, deletable
- **Date events**: Auto-created nodes (year / year-month / year-month-day) that anchor regular events in time. Immutable.

### Event Roots

An event can happen "while" other events were ongoing. A root captures that "while" relationship — event B happened while event A was happening. An event can have multiple roots.
