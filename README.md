# sonnesystems.com

Public website for **Sonne Systems**, an independent AI research and engineering company.

- Live: https://sonnesystems.com
- Owner: Aman Agarwal, 9aman.aa@gmail.com, [@9aman-og](https://github.com/9aman-og)

## System shape

The public website is intentionally static: plain HTML, one CSS design system, and small readable JavaScript modules. It has no build step or runtime dependency. GitHub Pages serves it directly.

The separate `backend/` directory contains a tested FastAPI service for future server-backed features. The public website does not need that service to load, navigate, or decrypt the paper archive.

## Public routes

```text
index.html       Company home and scroll-led research story
research.html    Verified research record and known limits
ventures.html    Lyfe product page plus Lyfe Alt and Lyfe Store previews
lyfe/            Installable Lyfe personal workspace application
about.html       Studio, contracts, founder, and contact
papers.html      Password-protected encrypted paper archive
404.html         Site-wide not-found page
```

`demo.html` and `tools.html` are noindex redirects retained only so old external links do not break.

## Important files

```text
css/styles.css                 Design tokens, layouts, motion, and responsive rules
js/site.js                     Shared navigation, footer, sound, reveal, transition, scroll sequence
js/papers.js                   Browser-only Web Crypto paper decryption
papers/*.pdf.enc               AES-256-GCM encrypted research PDFs
assets/SonneSystemsCompanyLogo.png  1024 px transparent single-colour wheel mark
assets/og.png                  1200 x 630 social preview
scripts/checks.py              Link, style, and encrypted-file checks
scripts/encrypt_paper.py       Paper encryption and round-trip verification
backend/                       FastAPI and SQLite service scaffold with tests
```

## Run locally

```powershell
python -m http.server 4180
# open http://localhost:4180
```

Run verification:

```powershell
python scripts/checks.py
cd backend
python -m pytest -q
```

## Publish

Push `main`. GitHub Pages deploys the static site automatically. See `docs/DEPLOYMENT.md` for the domain and workflow details.

## Engineering rules

1. Keep the public site build-free and progressively enhanced.
2. Respect `prefers-reduced-motion` and preserve keyboard access.
3. Do not commit plaintext papers, passwords, or private credentials.
4. Keep research claims tied to an artifact and state the known boundary.
5. Run both the site checks and backend tests before publishing.
