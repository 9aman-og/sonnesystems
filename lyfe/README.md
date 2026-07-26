# Lyfe

Lyfe is a private execution system for people doing difficult, self-directed
work. It joins daily planning, deep focus, projects, notes, and EOS in one fast
offline-first web app.

The product is built around one loop:

1. Capture what has your attention.
2. Choose one visible finish line.
3. Focus on one task without changing tools.
4. Record what moved forward.

It deliberately avoids template maintenance, punitive streaks, noisy
dashboards, and automatic schedules that break when real life changes.

## Core workspace

- **Today** recommends a useful next task, keeps the daily plan short, and shows
  only decision-relevant progress.
- **Focus** runs a 15, 25, 50, or 90 minute work block around one chosen task.
  Pausing and resuming survives navigation and refreshes.
- **Tasks** support priority, due dates, energy level, expected focus time, and
  a concrete first visible step.
- **Projects, goals, learning, work log, notes, and docs** hold longer-term
  context without crowding the daily workflow.
- **EOS** accepts natural language capture and can use an optional local or
  user-provided model.
- **Focus video** is an optional privacy-enhanced YouTube mini-player. It exists
  only after the user opens it and is removed when closed.

## Product principles

- The default screen asks for one decision, not ten.
- Progress is feedback, not a judgment.
- Concrete next actions reduce startup cost.
- Keyboard, touch, and screen-reader paths are first-class.
- Motion communicates state and respects reduced-motion preferences.
- Light and dark mode use the same information hierarchy.
- Existing Lyfe data remains compatible across interface updates.

## Data and privacy

Guest data is stored on the current device in `localStorage` under `lyfe.v1`.
Export and import provide a portable JSON backup. Optional Supabase sign-in can
add private cross-device sync; API keys are excluded from remote sync.

The app shell is cached for offline use. Third-party API calls, YouTube embeds,
and model connections are never placed in the offline cache.

## Run locally

Serve the repository root with any static HTTP server, then open `/lyfe/`.
There is no framework, dependency install, or build step.

## Main files

- `index.html` - accessible application shell
- `system.css` - current design system and responsive behavior
- `styles.css` - legacy component compatibility styles
- `app.js` - data model, views, EOS, focus timer, and interaction logic
- `cloud.js` - optional private sync
- `sw.js` - offline application shell
