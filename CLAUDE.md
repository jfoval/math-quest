# Math Quest — working notes for Claude

Kids' math-facts PWA for John's kids (one is 11). Plain JS modules, no build step. Live at
https://jfoval.github.io/math-quest/ (GitHub Pages from `main` of github.com/jfoval/math-quest; push = deploy in ~1 min).
Netlify is NOT used (account blocked). README.md is the user-facing description; this file is the dev map.

## Non-negotiables
- Must work great on iPad/phone (touch, big targets, no page-scroll hijack in games) AND desktop (keyboard). Verify both sizes.
- Kid-facing: never scold, no native `confirm()`/`alert()` in kid flows, speed is a bonus never a fail.
- Everything earns stars via the same spaced-repetition engine; every new mode must call `Session.answer()`.
- Design: hand-drawn SVG/voxel art, not emoji-as-design (emoji ok for small UI glyphs). Roblox-ish blocky vibe.

## Map
- `js/app.js` — all screens (template strings) + the single click handler (`data-*` attrs). `go(screen)` renders.
- `js/engine.js` — facts/placement/Leitner boxes/unlock rules/`Session` (family + filter options) / `MixedSession` / `troubleFacts`.
- `js/facts.js` — fact tables. `js/teach.js` — strategy tips + ten-frame/array visuals.
- Games: `asteroids.js`, `builder.js` (Smoothie Shop / Array Farm), `bingo.js`, `obby.js` — each a class `{kid, op, root, onEnd, speak}` registered in `GAMES` in app.js.
- `js/voxel.js` (iso cube renderer, blocky avatar, HATS/FACES/GEAR), `js/base.js` (Star Base items + interactive pan/zoom/drag `mountBase`), `js/art.js` (planets, rocket), `js/companion.js` (Bolt + lines).
- `js/sound.js` (WebAudio synth kit + generative music moods), `js/confetti.js`.
- Accounts: `js/api.js` (raw Supabase REST/GoTrue), `js/account.js` (family/kid/parent, dirty-hash sync), `js/config.js` (project URL/key; empty = local-only mode), `supabase-schema.sql` (tables, RLS, RPCs — safe to re-run).
- `js/store.js` localStorage + `normalizeKid`. `sw.js` network-first SW (bump `CACHE` when adding files to the precache list).

## Gotchas learned the hard way
- CSS class / `data-*` collisions across components have bitten three times (`.field`, `.shop`, `data-family`). Use specific names; grep before adding.
- CSS `animation: transform` on an SVG `<g>` overrides its `transform` attribute — wrap animated items in an inner group.
- Painter's order in voxel scenes sorts by origin (x+y); flat items under tall ones need the taller one later.
- Kids may only push their own `progress` row (RLS); parents push family kids. `account.prime()` after any load so hashes don't mark everything dirty.
- Parent zone requires password; `parentAuthed()` = 15-min sessionStorage grace.
- Dates for streaks use local time (`localDate`), not UTC.

## Testing workflow (what actually works)
- Dev server: `.claude/launch.json` → `mathquest` (python http.server 8765). Browser pane hides between calls, so rAF-driven animation freezes; layout checks need a screenshot first. Browser HTTP cache is sticky: `fetch(url,{cache:'reload'})` then `location.reload()`.
- Account mode without a real project: `node scratchpad/mock-supabase.mjs` (port 8766) and set `localStorage mq.devurl/mq.devkey` (see js/config.js). The mock lives in the session scratchpad — recreate from account.js/api.js if missing.
- Drive flows with a `window.__auto` keyboard-typing helper (see git history / prior sessions); `#question` text parsing.
- Headless engine sims: `node` + `import('.../js/engine.js')`.

## Pending / open
- Supabase project: user must create it and paste URL + anon key into `js/config.js` (README steps). Until then live site = local-only mode.
- Ideas backlog: weekly "progress postcard", seasonal items, two-device race, base items with levels.
