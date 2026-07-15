# Architecture

## The one-paragraph version

sonnesystems.com is a **static site** (HTML/CSS/JS, no build step) hosted on **GitHub Pages**,
with an **API backend scaffold** (`backend/`, FastAPI + SQLite) that is written, tested, and
ready to deploy the day a feature actually needs a server. The site works fully without the
backend. This split is intentional: static content cannot go down, costs nothing, and cannot
be broken by a bad deploy; dynamic features get added behind an API only when they earn their keep.

## Why not "a big backend like Google/Notion"?

Those companies run servers because their products are *made of* user data. This site's job today
is: present research, run a client-side demo, gate two PDFs, and host Lyfe (a local-first app that
deliberately keeps user data on-device). None of that requires a server, and adding one prematurely
would only add cost, attack surface, and things to break. What we adopt from those companies is their
*discipline*, which lives in this repo right now:

- one source of truth for shared UI (`js/site.js` injects header/footer on every page)
- design tokens in one place (`css/styles.css` `:root`)
- CI that blocks broken links, style violations, and backend regressions on every push
- docs a new engineer can onboard from without asking anyone
- tests for everything that has logic in it

## The site

```
Browser ──▶ GitHub Pages (static)
             ├── index/demo/research/tools/about/papers/404 .html
             ├── css/styles.css     one stylesheet, design tokens on top
             ├── js/site.js        shared chrome (header, footer, reveal, sounds)
             ├── js/app.js         demo logic (demo.html only)
             ├── papers/*.pdf.enc  AES-256-GCM blobs, decrypted in-browser (Web Crypto)
             └── lyfe/             Local-first Lyfe PWA (optional Supabase sync)
```

Key decisions:

- **Multi-page, not SPA.** Each section is its own document: simpler, indexable, nothing to hydrate.
  Shared chrome is injected by `site.js` so a nav change is one edit.
- **Paper protection** is real cryptography, not a hidden link: PBKDF2 (SHA-256, 310k iterations)
  derives an AES-256-GCM key from the password, in the browser, via Web Crypto. The ciphertext is
  public; the password never travels. Wrong password = failed GCM auth tag = clean error.
- **Animations** are CSS-first (keyframes + IntersectionObserver reveals) and fully disabled under
  `prefers-reduced-motion`.
- **Click sounds** are synthesized with Web Audio (no audio files), toggleable, and persisted in
  `localStorage` under `sonne.sound`.

## The backend (`backend/`)

FastAPI + SQLAlchemy + SQLite, structured the way a growing service should be:

```
backend/app/
  main.py        app factory, CORS, router registration
  config.py      env-driven settings (12-factor style)
  db.py          engine/session management
  models.py      ORM models: User, AuthToken, ContactMessage, NewsletterSignup
  schemas.py     Pydantic request/response contracts
  security.py    PBKDF2 password hashing, token issuing/hashing
  routers/       health, auth (register/login/logout/me), contact, newsletter
backend/tests/   pytest suite run by CI
```

Design notes:

- **Auth** is email + password. Passwords are stored as `pbkdf2$sha256$<iters>$<salt>$<hash>`;
  tokens are random 256-bit bearer tokens stored **hashed** (SHA-256) with an expiry. There are
  no sessions to leak and no JWT complexity until multiple services need it.
- **SQLite first.** It is a real database, it is zero-ops, and SQLAlchemy means swapping to
  Postgres later is a connection-string change plus a migration, not a rewrite.
- **The public site does not call the backend yet.** First integrations, in order of value:
  1. contact / paper-access request form (replaces mailto links)
  2. newsletter signup on the research page
  3. optional accounts for Lyfe cloud backup (Lyfe stays local-first; sync is opt-in)
- **Deployment target** when needed: any small host (Render, Fly.io, Railway) or a VPS.
  One `uvicorn` process behind the host's TLS is enough for a long time.

## Scaling honestly

The current stack serves the mission for years. The triggers that justify more:

| Trigger | Response |
|---|---|
| A form the site needs | Deploy `backend/` as-is, point the form at it |
| Real user accounts | Add rate limiting + email verification to auth |
| >10k daily API users | SQLite → Postgres; add a second uvicorn worker |
| A team of engineers | Branch protection + PR reviews (CONTRIBUTING.md already assumes this) |
