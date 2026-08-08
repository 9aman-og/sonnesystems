# sonnesystems.com

This is the public home of **Sonne Systems**, a small independent research and engineering studio led by Aman Agarwal.

We build AI systems, apps, and websites. The research side asks a practical question: how can a system keep learning without quietly becoming harder to understand or trust? The product side turns that same care into things people can actually use, including Lyfe and the early Lyfe Connect concept.

You do not need a technical background to follow the work. The site tries to say what we tested, what we found, and where the result stops. A paper is not treated as proof of more than its experiment can support.

- Live: https://sonnesystems.com
- Owner: Aman Agarwal, aman@sonnesystems.com, [@9aman-og](https://github.com/9aman-og)

## How the site is built

The public website is intentionally static: plain HTML, one CSS design system, and small readable JavaScript modules. It has no build step or runtime dependency. GitHub Pages serves it directly.

The separate `backend/` directory contains a tested FastAPI service for future server-backed features. The public website does not need that service to load, navigate, or open the paper archive.

## Public routes

```text
index.html       Company home and scroll-led research story
research.html    Verified research record and known limits
ventures.html    Lyfe product page plus Lyfe Connect and Lyfe Store previews
lyfe/            Installable Lyfe personal workspace application
lyfe/connect.html Early Lyfe Connect product concept
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
assets/SonneSystemsCompanyLogo.svg  Scalable single-colour sun mark
assets/SonneSystemsCompanyLogo.png  1024 px transparent PNG export
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

## Working rules

1. Keep the public site build-free and progressively enhanced.
2. Respect `prefers-reduced-motion` and preserve keyboard access.
3. Do not commit plaintext papers, passwords, or private credentials.
4. Tie every research claim to an artifact and say what it cannot establish.
5. Run both the site checks and backend tests before publishing.
