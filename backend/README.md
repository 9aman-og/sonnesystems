# Sonne Systems API

A small, well-tested FastAPI + SQLite backend for sonnesystems.com. **Not deployed yet**;
the public site is fully static and does not depend on it. This exists so the day a
feature needs a server (contact form, newsletter, accounts), the foundation is already
built, tested, and documented instead of being improvised under pressure.

## Run it

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# interactive docs: http://127.0.0.1:8000/docs
```

## Test it

```powershell
cd backend
pytest -q
```

CI runs the same suite on every push (see `.github/workflows/ci.yml`).

## Endpoints

| Method | Path            | What it does                                   |
|--------|-----------------|------------------------------------------------|
| GET    | /health         | Liveness check                                  |
| POST   | /auth/register  | Create an account (email + passphrase of 12+ chars) |
| POST   | /auth/login     | Returns a bearer token (30-day expiry)          |
| GET    | /auth/me        | Current user (requires `Authorization: Bearer`) |
| POST   | /auth/logout    | Revokes the presented token                     |
| POST   | /contact        | Store a contact / paper-access message          |
| POST   | /newsletter     | Store a newsletter signup (idempotent)          |
| GET    | /ready          | Readiness check including database connectivity  |

## Design in one minute

- `app/config.py` reads bounded settings from environment variables (`SONNE_DB_PATH`,
  `SONNE_CORS_ORIGINS`, `SONNE_TRUSTED_HOSTS`, `SONNE_MAX_BODY_BYTES`, `SONNE_ENV`).
- `app/db.py` owns the SQLAlchemy engine/session. SQLite runs with foreign keys, WAL,
  a busy timeout, and connection health checks enabled.
- `app/models.py` is the schema. `app/schemas.py` is the API contract. They are separate on purpose.
- `app/security.py`: PBKDF2-HMAC-SHA256 password hashing (310k iterations, per-user salt);
  bearer tokens are 256-bit random values stored **hashed** with an expiry. Missing-user
  login attempts still perform a full derivation to reduce timing-based enumeration.
- `app/middleware.py` is the HTTP boundary: trusted hosts, 64 KiB request limits,
  per-client abuse throttles, request IDs, no-store behavior, and security headers.
- Routers are thin; anything with logic gets a test in `tests/`.

The built-in rate limiter is deliberately process-local and stores no durable IP data.
For a multi-instance deployment, enforce the same rules at the edge or in a shared store.

## Rules

- Never commit a `.db` file or a secret (gitignored, and reviewers should still look).
- Every new endpoint ships with tests in the same PR.
- Passwords/OTPs are never handled by this service beyond the hashed password field.
