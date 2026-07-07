# Deployment

## The site (GitHub Pages)

Production deploys are automatic: **push to `main` and GitHub Pages rebuilds** (~1 minute).

- Repo: https://github.com/9aman-og/sonnesystems
- Pages config: branch `main`, root `/`, custom domain `sonnesystems.com` (the `CNAME` file)
- Temporary URL until DNS resolves: https://9aman-og.github.io/sonnesystems/

### DNS (GoDaddy)

The domain must point at GitHub Pages. In GoDaddy DNS for `sonnesystems.com`:

| Type  | Name | Value              |
|-------|------|--------------------|
| A     | @    | 185.199.108.153    |
| A     | @    | 185.199.109.153    |
| A     | @    | 185.199.110.153    |
| A     | @    | 185.199.111.153    |
| CNAME | www  | 9aman-og.github.io |

**Important:** GoDaddy "Domain Forwarding" must be OFF. Forwarding overrides A records;
its telltale IPs are `13.248.243.5` and `76.223.105.230`. If a lookup returns those,
forwarding is still active.

After DNS propagates and GitHub issues the certificate, enforce HTTPS:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api -X PUT repos/9aman-og/sonnesystems/pages -f https_enforced=true
```

### Checks after a deploy

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api repos/9aman-og/sonnesystems/pages --jq .status          # "built"
& "C:\Program Files\GitHub CLI\gh.exe" api repos/9aman-og/sonnesystems/pages/builds/latest --jq .status
```

## The backend (when a feature needs it)

`backend/` deploys to any host that runs Python:

1. Provision (Render/Fly.io/Railway free tier is fine to start).
2. `pip install -r backend/requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` with env vars:
   - `SONNE_DB_PATH` : absolute path to the SQLite file (mount persistent storage)
   - `SONNE_CORS_ORIGINS` : `https://sonnesystems.com`
4. Point site forms at the API base URL.

## Credentials policy

Nobody (human or AI) ever needs the GoDaddy or GitHub **password/OTP** to operate this project.
GitHub: `gh auth login --web` (browser OAuth). GoDaddy: DNS edits are made by the owner in the
dashboard, or via a scoped, revocable API key. Passwords and one-time codes are never shared, ever.
