# sonnesystems.com

The public site of **Sonne Systems**, a neuromorphic engineering and BCI research studio.

- **Live:** https://sonnesystems.com (GitHub Pages; temporary URL https://9aman-og.github.io/sonnesystems/)
- **Owner:** Aman Agarwal · 9aman.aa@gmail.com · [@9aman-og](https://github.com/9aman-og)

## What this is

A **zero-build static site** plus a **scaffolded API backend**:

- The public site is plain HTML/CSS/JS. No framework, no bundler, no npm. Open `index.html` and it works.
  This is a deliberate choice: nothing to compile means nothing to rot, and GitHub Pages hosts it for free.
- `backend/` is a FastAPI + SQLite service (auth, contact, newsletter) with tests. It is **not deployed yet**;
  the site does not depend on it. See `backend/README.md` and `docs/ARCHITECTURE.md` for when and how to wire it in.

## Repository map

```
├── index.html          Landing page (interactive aperture and scroll film)
├── demo.html           Spiking Mammal live demo
├── research.html       Projects & papers
├── tools.html          Premium utility-app showcase (Lyfe)
├── about.html          Studio, principles, contact
├── papers.html         Password gate for encrypted paper PDFs
├── 404.html            Not-found page (GitHub Pages serves this automatically)
├── css/styles.css      Ground-up Origin 01 design system and responsive components
├── js/site.js          Shared chrome, 360 orbital instrument, scroll film, motion, and optional sounds
├── js/app.js           Transparent browser-side temporal signal demo
├── js/papers.js        Local Web Crypto paper decryption
├── assets/             Social card and Lyfe identity
├── robots.txt          Crawler policy (private paper vault excluded)
├── sitemap.xml         Canonical public URLs for search engines
├── papers/*.pdf.enc    AES-256-GCM encrypted papers (safe to host publicly)
├── lyfe/               The Lyfe app, copied from G:\CLAUDE\lyfe (see "Lyfe sync" below)
├── backend/            FastAPI + SQLite API scaffold with tests (not yet deployed)
├── scripts/            Repo tooling: CI checks, paper encryption
├── docs/               Architecture and deployment docs
└── .github/workflows/  CI: site checks + backend tests on every push/PR
```

## Run it locally

```powershell
# the site (any static server works)
python -m http.server 4180
# then open http://localhost:4180

# the backend (optional; separate service)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs
```

## Deploy

Push to `main`. GitHub Pages redeploys automatically (~1 minute). Details: `docs/DEPLOYMENT.md`.

## House rules (enforced by CI)

1. **No em dashes** anywhere in copy or code. Use commas, colons, or hyphens.
   (The only exception: Lyfe's own regexes that strip em dashes from Sol's output.)
2. **No frameworks, no build step** on the public site. If a page needs JS, it is a small, readable file.
3. **Binary files** (`.png`, `.enc`, `.pdf`) are declared in `.gitattributes` so git never mangles them.
4. Every local link must resolve: CI checks `href`/`src` targets exist.
5. Papers are never committed unencrypted. Use `python scripts/encrypt_paper.py <in.pdf> <out.enc> <password>`.

## Lyfe sync

`lyfe/` is a copy of the Lyfe app so the site is self-contained. The source of truth lives at
`G:\CLAUDE\lyfe` (its own git repo). After editing Lyfe, re-sync:

```powershell
robocopy G:\CLAUDE\lyfe .\lyfe /E /XD .git
```

## For new contributors

Read `CONTRIBUTING.md` first, then `docs/ARCHITECTURE.md`. The short version: small PRs,
CI must pass, match the existing style, and never commit secrets or unencrypted papers.
