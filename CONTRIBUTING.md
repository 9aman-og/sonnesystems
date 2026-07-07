# Contributing

Welcome. This repo is deliberately simple; please keep it that way.

## Workflow

1. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
2. Make the change. Run the checks locally:
   ```powershell
   python scripts/checks.py          # site checks (links, em dashes, encrypted papers)
   cd backend; pytest -q             # backend tests (if you touched backend/)
   ```
3. Open a PR against `main`. CI runs the same checks; it must be green.
4. One approval from the owner merges it. `main` deploys to production automatically.

## Style

- **HTML/CSS/JS:** match what is already there. Two-space indent in JS/HTML.
  The stylesheet keeps design tokens (colors, fonts, spacing) in `:root` at the top; use the
  variables, never hard-code a color twice.
- **No frameworks or build tools** on the public site. This is a hard rule, not a preference.
- **No em dashes** in any text or code. CI fails the build if one appears.
- **Python (backend):** standard library first, small modules, type hints, tests for every route.

## What breaks things (please do not)

- Renaming `css/`, `js/`, `papers/`, or `assets/` paths without updating every page that references them
  (CI's link check will catch this).
- Committing an unencrypted paper PDF, a password, an API key, or a `.db` file.
- Editing files inside `lyfe/` directly. Lyfe's source of truth is a separate repo; changes here get
  overwritten on the next sync. See "Lyfe sync" in the README.
- Adding npm/node_modules to the site. If a feature truly needs a dependency, it belongs in `backend/`
  or a separate service, with a design note in `docs/ARCHITECTURE.md` first.

## Commit messages

Imperative and specific: `Fix gate error copy on wrong password`, not `updates`.

## Security

Found a vulnerability? Email 9aman.aa@gmail.com. Do not open a public issue for it.
