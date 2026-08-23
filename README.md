# Math Quest 🚀

A math-facts adventure for kids. Addition → Subtraction → Multiplication → Division, with a per-kid profile,
a placement "scan", and a spaced-repetition engine so every kid works on exactly the facts they don't know yet.

No build step, no dependencies. It's a static PWA: works offline, installs to the home screen on iPad/iPhone/Android,
and as a desktop app in Chrome/Edge. Touch (big numpad) and keyboard (digits auto-submit, Backspace, Esc) both work.

## Run it locally

```bash
python3 -m http.server 8765
```
then open http://localhost:8765 (service workers need http, not file://).

## Host it (free options)

Upload the folder as-is to any static host — Netlify Drop, Vercel, GitHub Pages, Cloudflare Pages.
HTTPS is required for "Add to Home Screen" to install as a real app.

## Install on devices

The player screen shows an install hint automatically (an *Install* button on Android/Chrome/Edge; step-by-step
"Add to Home Screen" instructions on iPad/iPhone) until it's installed or dismissed.

- **iPad / iPhone (Safari):** Share → *Add to Home Screen*. Opens full-screen, no browser bars.
- **Android (Chrome):** menu → *Install app* (or the install banner).
- **Mac / Windows (Chrome/Edge):** click the install icon in the address bar.

## How the learning works

- **Placement scan** — the first time a kid opens an operation they get ~20 quick questions (2 per fact family).
  A family answered fully right *and fast* is marked "known" for the whole family, so an 11-year-old flies
  through addition in one sitting instead of grinding 2+3.
- **Missions** — 20 questions. The engine mixes: facts currently being learned (max 3 at a time), reviews that are
  due, and brand-new facts (easiest families first). After a miss the kid sees the answer and must **type it**
  before continuing, and the fact is re-asked a couple of questions later.
- **Teach cards** — the first time a fact is introduced it's shown *with* the answer, a visual (ten-frame dots for
  +/−, an array grid for ×/÷) and a strategy tip (doubles, make-a-ten, the ×9 trick, "think 5 + ? = 12"…). The kid
  types it once to lock it in, then it's asked for real a couple of questions later.
- **Mixed missions** — once two or more planets are scanned, a 🌠 Mixed mission interleaves all of them (weighted
  toward whatever has the most reviews due). Interleaved practice is better for long-term retention than blocked drills.
- **Spaced repetition** — each fact has a box 0–5. Fast+correct moves it up; a miss drops it 2 boxes.
  Review intervals: 10 min → 1 day → 3 days → 7 days → 21 days. A fact must be answered quickly on several
  separate days to count as *mastered*, and mastered facts are re-checked every 3 weeks (that's the periodic retest).
- **Unlocking** — the next operation unlocks when 85% of the current one is "known" (box 3+). Kids can still
  replay earlier planets; parents can unlock anything early.
- "Fast" = under 4 s for +/−, 6 s for ×/÷ at the *normal* setting. Parents can set each kid to **relaxed** (≈6 s / 10 s)
  or **fast** (≈3 s / 4 s) in the parent zone. Tweak in `js/engine.js` (`speedLimit`, `INTERVALS`, `UNLOCK_RATIO`).

## Game Room (the math *is* the action)

Every scanned planet has a Game Room. Same facts, different verbs — all modes feed the learning engine:

- **Asteroid Blaster** — numbered asteroids drift at your ship; tap the right one (or press 1–4). Shields, combos, survival bonus.
- **Smoothie Shop** (+/−) — customers order with a math problem; fill ten-frames with exactly the right fruit and blend. No timer; built for younger kids and new facts.
- **Array Farm** (×/÷) — drag across a field to plant rows of seeds; skip-counts appear as rows fill, then harvest by typing the total. Shows *why* 7 × 6 is 42.
- **Math Obby** — your blocky avatar hops across floating platforms over lava; each jump is a choice of three answers. Wrong platforms crumble.
- **Bingo Bugs** — 5×5 card of answers; solve, tap, a bug lands. Two lines wins.
- **Mission** — the classic typed drill, now a rocket flight with a visible fuel timer (speed is a bonus, never a fail).

## Star Base, avatars & Bolt

- **Stars are currency.** Spend them on the **Star Base** — a 12×12 voxel (blocky, Roblox-style) moon plot with 15
  buildable items (flag, landing pad, solar array, dome, rover that drives, alien crystals, rocket silo…), some animated.
  Drag the background to look around, pinch/scroll to zoom, and drag any item (or your character) to rearrange;
  layouts are saved per kid.
- **Blocky avatar** — skin/shirt/pants colours are free; hats and faces are bought with stars. The avatar appears on
  the home screen, the login cards, the base and in the Obby.
- **Bolt** — the ship's robot. Greets you, introduces new facts, reacts to results, and never scolds.
- **Sound** — a synthesised kit (plucks that climb with your combo, lasers, explosions, coins, jingles) plus soft
  generative background music with its own toggle. No audio files, works offline.

## Fun layer
- **Daily goal & streaks** — 2 missions/day goal, 🔥 day-streak with bonus stars on the first mission each day.
- **Planet screens** — tap a planet for Mission / ⚡ Lightning / ⚔️ Boss, plus *Practice a set* buttons to drill
  one family (e.g. just the ×7s), each showing its own progress.
- **Boss battles** — unlock after 2 missions on a planet; drawn from facts the kid already knows (plus a few in progress). Correct = hit, fast = critical (2 dmg), wrong = lose a heart.
  Five escalating bosses (Glitch → Kraken → Mega-Bot → Number Dragon → Chaos King).
- **Badges** — 20 achievements (perfect mission, 20-combo, streaks, lightning records, boss wins, planet mastered…).
- **Read aloud** — 🗣️ toggle on the home screen speaks each question (built-in speech synthesis) for younger readers.
- **Sibling Race** — from the player screen, pick two kids: 2 rounds × 5 questions each, alternating turns on one
  device. Each kid answers on *their own* planet, so a 6-year-old on addition can beat an 11-year-old on multiplication.
  Fast & right = 3 points, right = 2. Winner gets +50 ⭐; all answers still count toward learning.
- **Certificates** — when every fact on a planet is mastered, a printable Certificate of Mastery appears on that
  planet (Print / Save as PDF).
- Parents see a **weekly summary** per kid (missions, days played, accuracy, facts newly known / mastered, with
  week-over-week arrows), a 7-day activity strip, streak and boss count.

Stars (×2/×3/×4 combo multipliers, speed bonus), XP levels, a crew of 20 creatures unlocked by level,
confetti, synth sound effects (no audio files), a 30-second ⚡ Lightning round after each mission with personal records.

## Parent zone

Tap *Parent zone* on the player screen (you set a 4-digit PIN the first time). Shows, per kid and operation,
a colour heat-map of every single fact (unknown → learning → known → mastered), accuracy over recent missions,
plus: unlock an operation early, reset & re-scan, change a kid's PIN, delete a player, and **Export / Import backup**
(export uses the share sheet on iPad/phone, a file download on desktop). If storage is blocked (e.g. private browsing)
a red warning appears so progress never silently vanishes.

## Accounts & progress (Supabase)

With a Supabase project configured, Math Quest has real logins:

- **Parents** sign up with email + password and create the family (a second parent joins with the invite code
  shown in the parent zone).
- **Kids** get their own **username + password** (a 4-digit PIN works), created by a parent. They log in on any
  device themselves; devices remember them so after the first time it's one tap on their avatar.
- **Progress is saved to the database** after every activity and pulled on login/app-open, with a local copy so
  play continues offline and syncs when back online.
- The **parent zone** (parent login only) shows every kid's time, progress and heat-maps, and manages accounts
  (add kid, edit name/avatar, reset password, delete).

### One-time setup

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**: paste [`supabase-schema.sql`](supabase-schema.sql) → Run.
3. **Authentication → Providers → Email**: turn **off** "Confirm email" (kids have no real email).
   **Authentication → Settings**: minimum password length → **4** (so kids can use a PIN).
4. Put the project URL + anon key in [`js/config.js`](js/config.js) and deploy.

Without a configured project the app runs in local-only mode (players + PIN stored on the device).

## Files

- `index.html`, `css/style.css` — shell & responsive styling (phone, tablet, desktop split layout)
- `js/facts.js` — fact tables per operation
- `js/engine.js` — placement, spaced repetition, mission question selection, unlock rules
- `js/store.js` — persistence, export/import
- `js/app.js` — all screens & game loop
- `js/api.js`, `js/account.js`, `js/config.js`, `supabase-schema.sql` — accounts, family, cloud progress
- `js/teach.js` — strategy tips and fact visuals for teach cards
- `js/sound.js`, `js/confetti.js` — effects
- `manifest.webmanifest`, `sw.js`, `icon*.{svg,png}` — PWA install & offline support
