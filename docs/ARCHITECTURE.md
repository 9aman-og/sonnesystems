# Architecture

## Public website

Sonne Systems uses a multi-page static website hosted on GitHub Pages.

```text
Browser
  -> GitHub Pages
     -> HTML pages for Home, Research, Ventures, Studio, and Papers
     -> css/styles.css for one shared responsive design system
     -> js/site.js for shared navigation and progressive interaction
     -> js/papers.js for local paper decryption
     -> papers/*.pdf.enc for encrypted research artifacts
```

This architecture keeps the public surface fast, indexable, and small. Each page remains useful without JavaScript. JavaScript adds the shared header and footer, reveal pacing, the scroll-led radial sequence, optional sound, and smooth navigation.

## Interaction boundaries

- Motion is CSS-first and disabled for `prefers-reduced-motion`.
- Sound is off by default, synthesized with Web Audio, and stored only as a local preference.
- Mobile navigation uses a real button with `aria-expanded` and closes with Escape.
- Page changes use a short opacity and position transition, then perform a normal document navigation.
- Old Demo and Tools URLs redirect to current pages so external links continue to resolve.

## Private paper archive

Each paper is encrypted before it enters the repository.

```text
passphrase
  -> PBKDF2 SHA-256, 310,000 iterations
  -> AES-256-GCM key
  -> SSE1 encrypted file
  -> decrypted locally with Web Crypto
```

The passphrase is never sent to a server. The archive is a collaboration gate for a static site, not an access-control service. Use a server-backed identity and authorization system if per-person access, revocation, or audit logs become necessary.

## Backend scaffold

`backend/` is a separate FastAPI and SQLite service with tested health, authentication, contact, and security boundaries. It is not currently required by the website.

```text
backend/app/
  main.py        Application setup and router registration
  config.py      Environment-driven settings
  db.py          Database engine and sessions
  models.py      User, token, contact, and newsletter models
  schemas.py     Request and response contracts
  security.py    Password hashing and token handling
  routers/       Feature-specific endpoints
backend/tests/   Automated behavior and security tests
```

Deploy the backend only when a feature needs server-owned data. Before production deployment, add the production database, rate limits, email verification, observability, backups, and a reviewed secret-management path.
