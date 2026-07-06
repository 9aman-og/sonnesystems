# Taking sonnesystems.com live

The whole site lives in this `web/` folder. It is a plain static site (no build step),
so any static host works. Recommended: **GitHub Pages** (free, free HTTPS, custom domain).

## Security first (read this)

Never paste a password or one-time code into a chat or a script. You do not need to.
GitHub logs you in through your own browser, and GoDaddy DNS is edited by you in the
GoDaddy dashboard. Nobody, including an AI assistant, ever needs your credentials.

## Fastest path: GitHub Pages

1. **Log in once** (opens your browser, authenticates as `9aman-og`):

   ```powershell
   & "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web
   ```

2. **Deploy** (from this `web\` folder):

   ```powershell
   ./deploy.ps1
   ```

   This creates `9aman-og/sonnesystems`, pushes the site, and turns on Pages.
   A temporary URL `https://9aman-og.github.io/sonnesystems/` goes live within a minute.

3. **Point the domain (GoDaddy).** In GoDaddy: `Domain Portfolio -> sonnesystems.com -> DNS`.
   Delete any parked/forwarding `A` record on `@`, then add:

   | Type  | Name | Value            |
   |-------|------|------------------|
   | A     | @    | 185.199.108.153  |
   | A     | @    | 185.199.109.153  |
   | A     | @    | 185.199.110.153  |
   | A     | @    | 185.199.111.153  |
   | CNAME | www  | 9aman-og.github.io |

   The `CNAME` file in this folder already tells Pages the domain is `sonnesystems.com`.
   Propagation takes minutes to a few hours. GitHub then issues the HTTPS certificate
   automatically.

## Alternatives (no GitHub)

- **Netlify Drop:** zip this folder, drag it onto https://app.netlify.com/drop. Instant URL.
  Then add the custom domain in Netlify and point GoDaddy DNS at Netlify.
- **Cloudflare Pages:** connect the repo or upload the folder; then move the domain's
  nameservers to Cloudflare (easiest DNS) or add a CNAME.

## Keeping Lyfe in sync

Lyfe is copied into `web/lyfe/`. If you edit the original at `G:\CLAUDE\lyfe`, re-sync with:

```powershell
robocopy "G:\CLAUDE\lyfe" "G:\CLAUDE\web\lyfe" /E /XD .git
```

then run `./deploy.ps1` again.

## The password-protected papers

`papers/*.pdf.enc` are AES-256-GCM encrypted, so publishing them is safe. The password
is required in the browser to decrypt. To add or rotate a paper, re-run the encrypt
script (see the project notes) and drop the new `.enc` file in `papers/`.
