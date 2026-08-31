# Lyfe - your life, lightly kept

One calm place for everything: what you are tracking, what you want to keep,
what you are learning, and **Aero**, the personal intelligence that works across it.

No frameworks, no build step, no runtime package dependencies. The small static
files are intended to remain readable and portable.

The clean-room product architecture and evaluation gate are documented in
[`AERO.md`](AERO.md).

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
| Aero     | Permissioned context, typed memory, approved actions, and outcome feedback across Lyfe |
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

## Aero, the personal intelligence layer

Aero is not a separate research system or a generic autonomous agent. It is the
consumer intelligence layer inside Lyfe. EOS and EOS-F1 remain separate Sonne
Systems research work; no EOS or unpublished research code is used here.

Aero's current vertical slice includes:

- a bounded context pack spanning Today, Tracking, Library, Connect, Gmail
  metadata, and Profile, with a separate permission for every source;
- episodic, semantic, project, and procedural memory;
- visible memory states: candidate, provisional, active, and disputed;
- an epistemic governor that answers, previews, or asks one focused question;
- reversible in-Lyfe action previews that require approval;
- local outcome telemetry for first-pass intent and instruction length;
- manual, consent-gated JSONL export of examples explicitly rated helpful.

The built-in deterministic adapter understands common plain-text workflows:

- `remind me to email prof tomorrow` → task, due tomorrow
- `log 2h on spike encoder` → work log entry
- `note: read Maass 1997` → note
- `done email prof` → ticks the task off
- `goal: publish SNN paper` / `doc: research plan` / `learning: Spanish`
- `how am i doing` / `what's due` → a status rundown
- or just say `hi` - Aero says hi back, greets you whenever you open the app
  after a break, and checks in on its own while the app is open
- vent to it ("i'm so tired") and it responds like a friend, not a form

Aero routes between replaceable engines in **Settings**:

1. **Ollama.** A configurable local open model receives the permitted context
   pack and a strict structured-action schema.
2. **Offline deterministic tools.** No model at all; the built-in commands above
   still work.
3. **Groq GPT-OSS.** An optional authenticated Edge Function provides free-tier
   reasoning for cloud-safe prompts. It receives only the current prompt and
   date. The Lyfe context pack, Gmail, memory, notes, imported chats, and prior
   messages are never included. Workspace actions and personal-context requests
   stay local even when this route is enabled. No paid tier is required; quota
   exhaustion falls back to Aero local instead of becoming billable usage.
4. **Cloud specialists.** GPT/Codex and Gemini are shown as honest adapter states,
   but are not labelled connected until a supported private bridge exists. A
   consumer ChatGPT Plus or Google AI Pro subscription is not treated as API
   credit and Aero never scrapes an account session.
5. **Inkling.** The open-weight multimodal model is an evaluated future specialist,
   not the free local default; even Inkling-Small's quantized checkpoint requires
   server-class GPU memory.

The device-only Knowledge vault can import a user-owned ChatGPT
`conversations.json`, Gemini Takeout JSON/HTML, and text or Markdown files. It
indexes those records in IndexedDB, retrieves only relevant excerpts per turn,
and shows source provenance. The vault is not included in Lyfe account sync.

If a selected model is unreachable, Aero falls back to the deterministic tools.
The app does not claim that exporting examples trains a foundation model. Run a
separate reviewed training experiment only after the evaluation set and consented
dataset are large enough to justify one.

Run the clean-room Aero checks with:

```powershell
node aero-core.test.js
node cloud.test.js
```

## Your data

Guest data is stored in the browser's `localStorage` under the key `lyfe.v1`.
It stays on that device. If the optional Supabase integration is configured,
signing in enables private cross-device sync for the Lyfe ledger. Knowledge-vault
imports remain device-only and local Ollama calls stay on the configured local
endpoint.

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

Aero uses the same product logo and identity across Crystal, Orbit, Connect, the
sign-in screen, settings, and the Sonne Systems product pages. The home screen
uses Pins, Projects, and Pending shortcuts in place of the old decorative ticker.

## Files

- `index.html` - shell + sun logo
- `styles.css` - the look (Orbit dark + Crystal light identities, hover lift, chat)
- `app.js` - Lyfe UI and product workflows; plain JavaScript, no dependencies
- `aero-core.js` - clean-room context, memory, governance, and evaluation logic
- `aero-core.test.js` - deterministic Aero behavior checks
- `aero-knowledge.js` - device-only history import and relevant-context retrieval
- `tests/aero-knowledge.test.html` - browser checks for import, retrieval, and clearing
