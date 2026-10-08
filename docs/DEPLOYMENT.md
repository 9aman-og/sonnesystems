# Deployment

## The site (GitHub Pages)

Production deploys are automatic: **push to `main` and GitHub Pages rebuilds** (~1 minute).

- Repo: https://github.com/9aman-og/sonnesystems
- Pages config: branch `main`, root `/`, custom domain `sonnesystems.com` (the `CNAME` file)
- Pages URL: https://9aman-og.github.io/sonnesystems/ (redirects to the custom domain while it is configured)

### DNS

The domain must point at GitHub Pages. Set these records at the authoritative DNS provider for `sonnesystems.com`:

| Type  | Name | Value              |
|-------|------|--------------------|
| A     | @    | 185.199.108.153    |
| A     | @    | 185.199.109.153    |
| A     | @    | 185.199.110.153    |
| A     | @    | 185.199.111.153    |
| CNAME | www  | 9aman-og.github.io |

If using Cloudflare, set the apex and `www` records to **DNS only** while
GitHub validates the domain and renews the certificate. Proxied records hide
the Pages addresses and can prevent validation. On 2026-10-08, both names
resolved to Cloudflare proxy addresses and the site returned HTTP 526.

**Important:** GoDaddy "Domain Forwarding" must be OFF. Forwarding overrides A records;
its telltale IPs are `13.248.243.5` and `76.223.105.230`. If a lookup returns those,
forwarding is still active.

After DNS propagates and GitHub issues the certificate, enforce HTTPS:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api -X PUT repos/9aman-og/sonnesystems/pages -F https_enforced=true
```

### Checks after a deploy

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api repos/9aman-og/sonnesystems/pages --jq .status          # "built"
& "C:\Program Files\GitHub CLI\gh.exe" api repos/9aman-og/sonnesystems/pages/builds/latest --jq .status
```

## Renewing a failed Pages certificate

GitHub reported `bad_authz` on 2026-10-08 for the certificate that expired on
2026-10-05. Redeployment and removing/restoring `CNAME` did not clear it.
Both the connected GitHub integration and Actions `GITHUB_TOKEN` rejected
custom-domain updates with HTTP 403.

First correct the DNS records above. A repository administrator can then
remove and re-add `sonnesystems.com` in **Settings > Pages**, wait for GitHub
to provision a certificate, and enable **Enforce HTTPS**.

For scripted renewal, use a repository administrator's token with **Pages:
read and write** permission, scoped to this repository. The cloud environment
accepts it securely as `SONNE_PAGES_ADMIN_TOKEN`; the script uses that token
through `gh`. Run `python scripts/renew_pages_certificate.py` from the repo
root. Alternatively, add a repository Actions secret with the same name and
manually run **Renew Pages certificate**. Its `diagnostics_only` option needs
no extra secret and makes no changes.

It removes and restores the configured domain, waits for a valid certificate,
verifies HTTPS and site content on the apex and `www` hosts, then enables HTTPS
enforcement. A failed reset restores the original domain binding. A current
certificate is verified without resetting the domain. The workflow runs only
on manual dispatch. A Cloudflare token for automated DNS repair requires
**Zone: Read** and **DNS: Edit**, scoped to `sonnesystems.com`; enter it securely
as `SONNE_CLOUDFLARE_API_TOKEN` in the cloud environment settings.

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
