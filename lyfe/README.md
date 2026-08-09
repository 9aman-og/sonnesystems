# Lyfe - your life, lightly kept

One calm place for everything: what you are tracking, what you want to keep,
what you are learning, and **EOS**, a companion you can just talk to.

No frameworks, no build step, no dependencies. Three files that will still
open in twenty years.

## Opening it

Double-click `index.html` - it runs straight from disk in any modern browser.

Or serve it locally:

```
python -m http.server 4173 --directory .
# then open http://localhost:4173
```

## Install as an Android app (PWA)

Lyfe is a Progressive Web App, so it installs to your phone's home screen and
runs full-screen and offline - no Play Store, no build tools.

1. Put the folder on any HTTPS host (GitHub Pages, Netlify, Vercel, or your own
   server). Installing requires `https://` (or `localhost`); it will not install
   from a `file://` path.
2. Open the site in **Chrome on Android** → tap the **⋮** menu → **Add to Home
   screen** / **Install app**. On desktop Chrome/Edge an install icon appears in
   the address bar.
3. It launches with its own acid-lime sun icon, no browser chrome, and works
   offline (the service worker caches the app shell). Your data stays on-device
   in that app's storage.

Want a real Play Store `.apk`/`.aab`? Wrap this PWA with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (a Trusted Web
Activity) once it's hosted - no code changes needed.

Files added for this: `manifest.webmanifest`, `sw.js`, `icon-192/512*.png`.

## Sections

| Section  | What it holds |
|----------|---------------|
| Today    | What needs you now, Pins / Projects / Pending shortcuts, Connect activity, and a small Wander discovery break |
| EOS      | Your adaptive blob companion. Talk naturally and EOS files things for you |
| Connect  | The separate Lyfe Connect social and collaboration workspace |
| Tracking | Tasks, projects, goals, and a dated work log, organized as tabs |
| Library  | Searchable notes, pinned thoughts, and longer docs |
| Profile  | Your identity, approved Connect details, and your learning record |

## Lyfe Connect

`connect.html` is a functional, local-first preview of Lyfe Connect, a
networking platform for collaborators, peers, mentors, projects, and focused
communities. It combines a visual work feed, user-authored posts with optional
local images, context-rich profiles, a useful activity inbox, private outreach drafts, small topic Circles,
and lightweight workspace pages.

The preview uses clearly labelled fictional people and sample posts, while posts
you create are shown as your own local preview content. Connect stores its
activity in this browser under `lyfe.connect.preview.v1`; nothing is published
or sent to a real person. Approved profile fields can sync locally between Lyfe
and Connect, but tasks, notes, learning, and private workspace data never move.
A workspace page can offer its approved title and note to Lyfe as a task, but
Lyfe asks for confirmation before copying anything.

## EOS, the companion

EOS understands plain text and logs it for you:

- `remind me to email prof tomorrow` → task, due tomorrow
- `log 2h on spike encoder` → work log entry
- `note: read Maass 1997` → note
- `done email prof` → ticks the task off
- `goal: publish SNN paper` / `doc: research plan` / `learning: Spanish`
- `how am i doing` / `what's due` → a status rundown
- or just say `hi` - EOS says hi back, greets you whenever you open the app
  after a break, and checks in on its own while the app is open
- vent to it ("i'm so tired") and it responds like a friend, not a form

EOS never uses em dashes. Three brains, picked in **Settings**:

1. **Qwen via Ollama (default, local, free).** Install [ollama.com](https://ollama.com),
   run `ollama pull qwen3.5:9b` (or use `qwen3.5:27b`/`35b` on stronger hardware), and EOS
   becomes a real open-source LLM running on your own machine. Private, no keys.
   If you open Lyfe as a `file://` page rather than localhost, start Ollama with
   `OLLAMA_ORIGINS=*` so the browser may call it. EOS is prompt-tuned for Lyfe
   (persona + action protocol); true LoRA fine-tuning would need a training run.
2. **Claude API.** Paste an Anthropic key; strongest understanding. The key is
   stored only in this browser and sent only to `api.anthropic.com`.
3. **Offline parser.** No model at all; the built-in commands above still work.

Whichever brain is picked, if it is unreachable the built-in parser answers,
so EOS never goes silent.

## Your data

Guest data is stored in the browser's `localStorage` under the key `lyfe.v1`.
It stays on that device except for EOS's optional API calls. If the optional
Supabase integration is configured, signing in enables private cross-device
sync; the Anthropic API key is stripped before any sync write.

**The data belongs to one browser profile.** Use **Export** in the sidebar to
download a JSON backup regularly, and **Import** to restore or move machines.
Clearing site data erases the ledger - keep backups.

## Appearance

Lyfe has two complete identities, not two tints of one design:

- **Dark - Orbit.** Black, acid lime, sharp cyber-editorial. A left-rail
  control room with a synthwave horizon.
- **Light - Crystal.** A different building entirely: one frosted glass bar
  across the top, a front page built around a liquid-chrome orb with true-3D
  orbital rings and a satellite bead that floats and leans toward your cursor,
  a bento deck of live tiles, chrome-metal type (Unbounded), holo foils that
  slowly drift, aqua-glass buttons with a passing ad-glare, cards that tilt in
  3D under the pointer and unfold from blur as they enter - Y2K futurism by
  way of a 2000s Sony commercial. Even the icons and micro-copy change
  (`LYFE ::CRYSTAL`, `WELCOME.. ::2K`).

The old standalone Wander tab now lives on Today. Photos tune in over a clean
loading screen (no placeholder art), and you can flip places with the ← → keys.

Auto by default - Crystal in daylight hours, Orbit after dark; pick Light or
Dark in Settings to pin one. Cards lift softly under the cursor with an
iridescent light that follows it, and a thin holo rail tracks your scroll;
set your OS to reduced motion to turn all animation off.

EOS appears as a small liquid blob that changes with Crystal and Orbit, with a
gentle float, blink, and sleepy eyes after 11pm. The home screen uses Pins,
Projects, and Pending shortcuts in place of the old decorative ticker.

## Files

- `index.html` - shell + sun logo
- `styles.css` - the look (Orbit dark + Crystal light identities, hover lift, chat)
- `app.js` - all logic; plain JavaScript, no dependencies
