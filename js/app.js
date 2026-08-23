import { OPS, OP_ORDER, allFacts } from './facts.js';
import { store, AVATARS, normalizeKid } from './store.js';
import { Session, MixedSession, opStats, periodStats, familyStats, placementQuestions, applyPlacement, checkUnlocks, suggestedOp, speedLimit,
         lightningPool, bossPool, levelFor, xpForLevel, MISSION_LENGTH, opData } from './engine.js';
import { sound } from './sound.js';
import { confetti, burst } from './confetti.js';
import { makeQuestion } from './facts.js';
import { tip, visual } from './teach.js';
import { sync } from './sync.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CREATURES = [
  ['🐣', 'Chirpy'], ['🐢', 'Shelly'], ['🦊', 'Flash'], ['🐙', 'Inky'], ['🦄', 'Sparkle'], ['🐉', 'Ember'],
  ['🦖', 'Rexy'], ['🐳', 'Bubbles'], ['🦅', 'Skylar'], ['🦁', 'Roary'], ['🐲', 'Zap'], ['🦋', 'Flutter'],
  ['🐺', 'Howl'], ['🦈', 'Finn'], ['🐯', 'Stripes'], ['🦚', 'Dazzle'], ['🐲', 'Nova'], ['👾', 'Pixel'], ['🤖', 'Byte'], ['🌟', 'Star Captain'],
];

const state = { screen: 'login', kid: null, data: store.load() };
sound.setEnabled(state.data.settings.sound !== false);

// ---------- helpers ----------
function save() { store.save(); }
function go(screen, extra = {}) { Object.assign(state, { screen }, extra); render(); }
function kid() { return state.kid; }
function fmtPct(x) { return Math.round(x * 100) + '%'; }
function ring(pct, color, size = 96, label = '') {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,.12)" stroke-width="8" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="${size / 5}" font-weight="800">${label}</text>
  </svg>`;
}

// ---------- daily streak / badges ----------
const localDate = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const today = () => localDate(Date.now());
const yesterday = () => localDate(Date.now() - 86400e3);
const ensureKid = normalizeKid;
// Any completed activity keeps the streak alive; only real missions count toward the daily goal.
function touchDaily(k, isMission) {
  ensureKid(k);
  if (k.daily.date !== today()) { k.daily = { date: today(), missions: 0 }; }
  if (k.streak.last !== today()) { k.streak.count = k.streak.last === yesterday() ? k.streak.count + 1 : 1; k.streak.last = today(); }
  if (isMission) k.daily.missions++;
}
const DAILY_GOAL = 2;
const BADGES = [
  { id: 'first', e: '🎖️', n: 'First mission', d: 'Finish your first mission', t: (k) => k.missions >= 1 },
  { id: 'perfect', e: '💯', n: 'Perfect!', d: '20/20 on a mission', t: (k, c) => c.mode === 'mission' && c.correct === c.n },
  { id: 'combo10', e: '🔥', n: 'On fire', d: '10 in a row', t: (k, c) => c.maxCombo >= 10 },
  { id: 'combo20', e: '🌋', n: 'Unstoppable', d: '20 in a row', t: (k, c) => c.maxCombo >= 20 },
  { id: 'speed', e: '⚡', n: 'Speed demon', d: 'Answer in under 1 second', t: (k, c) => c.fastest < 1000 },
  { id: 'streak3', e: '📅', n: '3-day streak', d: 'Play 3 days in a row', t: (k) => k.streak.count >= 3 },
  { id: 'streak7', e: '🗓️', n: 'Week warrior', d: 'Play 7 days in a row', t: (k) => k.streak.count >= 7 },
  { id: 'streak30', e: '🏆', n: 'Legend', d: 'Play 30 days in a row', t: (k) => k.streak.count >= 30 },
  { id: 'm10', e: '🚀', n: 'Explorer', d: '10 missions', t: (k) => k.missions >= 10 },
  { id: 'm50', e: '🛰️', n: 'Voyager', d: '50 missions', t: (k) => k.missions >= 50 },
  { id: 'light15', e: '🌩️', n: 'Lightning 15', d: '15 correct in a lightning round', t: (k) => (k.best.lightning || 0) >= 15 },
  { id: 'light25', e: '🌪️', n: 'Lightning 25', d: '25 correct in a lightning round', t: (k) => (k.best.lightning || 0) >= 25 },
  { id: 'boss', e: '⚔️', n: 'Boss slayer', d: 'Win a boss battle', t: (k) => (k.best.bosses || 0) >= 1 },
  { id: 'boss5', e: '👑', n: 'Boss master', d: 'Win 5 boss battles', t: (k) => (k.best.bosses || 0) >= 5 },
  { id: 'stars1k', e: '⭐', n: 'Star collector', d: '1,000 stars', t: (k) => k.stars >= 1000 },
  { id: 'stars10k', e: '🌟', n: 'Star hoarder', d: '10,000 stars', t: (k) => k.stars >= 10000 },
  ...OP_ORDER.map(op => ({ id: 'master_' + op, e: OPS[op].emoji, n: OPS[op].planet + ' mastered', d: `Every ${OPS[op].name.toLowerCase()} fact mastered`, t: (k) => { const st = opStats(k, op); return st.mastered === st.total; } })),
];
function checkBadges(k, ctx = {}) {
  ensureKid(k); const fresh = [];
  for (const b of BADGES) { if (k.badges.includes(b.id)) continue; let ok = false; try { ok = b.t(k, ctx); } catch {} if (ok) { k.badges.push(b.id); fresh.push(b); } }
  return fresh;
}
function speak(text) {
  if (!kid()?.speak || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch {}
}
const speakText = q => `${q.a} ${({ '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' })[q.sym]} ${q.b}`;

// ---------- render ----------
function render() {
  app.className = 'screen-' + state.screen;
  const fn = screens[state.screen];
  app.innerHTML = fn ? fn() : '<p>?</p>';
  wire();
  app.scrollTop = 0;
}
const screens = {};

// ---------- LOGIN ----------
screens.login = () => {
  const kids = store.kids();
  return `
  <div class="center-col">
    <h1 class="logo"><span>Math</span> Quest</h1>
    <p class="sub">Who's playing today?</p>
    <div class="kid-grid">
      ${kids.map(k => `<button class="kid-card" data-login="${k.id}"><span class="avatar">${k.avatar}</span><span class="kname">${esc(k.name)}</span><span class="lvl">Lv ${levelFor(k.xp)} · ⭐ ${k.stars}</span></button>`).join('')}
      <button class="kid-card add" data-addkid><span class="avatar">＋</span><span class="kname">New player</span></button>
    </div>
    ${kids.filter(k => OP_ORDER.some(op => opStats(k, op).placed)).length >= 2 ? `<button class="btn accent" data-race>🏁 Sibling Race (2 players)</button>` : ''}
    <button class="link" data-parent>👨‍👩‍👧 Parent zone</button>
    ${installHint()}
  </div>`;
};
function installHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || localStorage.getItem('mq.installhint')) return '';
  if (state.installEvent) return `<div class="hint">📲 <b>Install Math Quest as an app</b> — works offline, opens full-screen. <button class="btn small" data-install>Install</button><button class="link" data-dismiss-install>Not now</button></div>`;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return `<div class="hint">📲 <b>Add to Home Screen</b> to play full-screen: tap the Share button <span class="ios-share">⬆︎</span>, then <b>Add to Home Screen</b>. <button class="link" data-dismiss-install>Got it</button></div>`;
  return '';
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installEvent = e; if (state.screen === 'login') render(); });

screens.newkid = () => `
  <div class="center-col narrow">
    <h2>New player</h2>
    <label class="field"><span>Name</span><input id="nk-name" maxlength="16" autocomplete="off" placeholder="Your name"></label>
    <p class="sub left">Pick your avatar</p>
    <div class="avatar-grid">${AVATARS.map((a, i) => `<button class="av ${i === 0 ? 'sel' : ''}" data-av="${a}">${a}</button>`).join('')}</div>
    <label class="field"><span>Secret PIN (optional, 4 digits)</span><input id="nk-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••"></label>
    <div class="row">
      <button class="btn ghost" data-go="login">Cancel</button>
      <button class="btn primary" data-createkid>Let's go! 🚀</button>
    </div>
  </div>`;

screens.pin = () => `
  <div class="center-col narrow">
    <div class="avatar big">${state.pinKid.avatar}</div>
    <h2>Hi ${esc(state.pinKid.name)}! Enter your PIN</h2>
    <div class="pin-dots" id="pin-dots">${'<span></span>'.repeat(4)}</div>
    <p class="err" id="pin-err"></p>
    ${numpad(false)}
    <button class="link" data-go="login">← Back</button>
  </div>`;

// ---------- HOME ----------
screens.home = () => {
  const k = kid(), lvl = levelFor(k.xp), nextXp = xpForLevel(lvl + 1), prevXp = xpForLevel(lvl);
  const lvlPct = (k.xp - prevXp) / (nextXp - prevXp);
  const sug = suggestedOp(k);
  const creatures = CREATURES.slice(0, Math.min(CREATURES.length, lvl - 1));
  ensureKid(k);
  const streakLive = k.streak.last === today() || k.streak.last === yesterday();
  const doneToday = k.daily.date === today() ? k.daily.missions : 0;
  const earned = BADGES.filter(b => k.badges.includes(b.id));
  return `
  <header class="topbar">
    <button class="iconbtn" data-go="login" title="Switch player">${k.avatar}</button>
    <div class="who"><b>${esc(k.name)}</b><div class="xpbar"><i style="width:${lvlPct * 100}%"></i></div><small>Level ${lvl} · ${k.xp - prevXp}/${nextXp - prevXp} XP</small></div>
    <div class="stars">⭐ ${k.stars}</div>
    <button class="iconbtn" data-speak title="Read questions aloud">${k.speak ? '🗣️' : '🤫'}</button>
    <button class="iconbtn" data-sound title="Sound">${state.data.settings.sound ? '🔊' : '🔇'}</button>
  </header>
  <section class="daily">
    <div class="chip ${streakLive && k.streak.count ? 'hot' : ''}">${streakLive && k.streak.count ? `🔥 ${k.streak.count}-day streak` : '🔥 Play today to start a streak'}</div>
    <div class="chip goal"><span>Today's goal</span><i>${Array.from({ length: DAILY_GOAL }, (_, i) => `<b class="${i < doneToday ? 'on' : ''}"></b>`).join('')}</i>${doneToday >= DAILY_GOAL ? '✅ Done!' : `${doneToday}/${DAILY_GOAL} missions`}</div>
  </section>
  <section class="planets">
    ${OP_ORDER.map(op => {
      const o = OPS[op], st = opStats(k, op), locked = !k.unlocked.includes(op);
      const label = locked ? '🔒' : !st.placed ? 'NEW' : fmtPct(st.pct);
      return `<button class="planet ${locked ? 'locked' : ''} ${op === sug ? 'suggested' : ''}" data-planet="${op}" ${locked ? 'disabled' : ''} style="--c:${o.color}">
        ${ring(locked ? 0 : st.pct, o.color, 110, label)}
        <span class="pemoji">${o.emoji}</span>
        <span class="pname">${o.planet}</span>
        <span class="psub">${o.name}${!locked && st.due ? ` · ${st.due} to review` : ''}</span>
        ${op === sug && !locked ? '<span class="tag">Go here!</span>' : ''}
      </button>`;
    }).join('')}
  </section>
  <div class="cta"><button class="btn primary huge" data-op="${sug}">${OPS[sug].emoji} Start mission</button>${k.unlocked.filter(op => opStats(k, op).placed).length >= 2 ? `<button class="btn accent huge" data-mixed>🌠 Mixed mission</button>` : ''}</div>
  <section class="collection">
    <h3>Your crew <small>${creatures.length}/${CREATURES.length}</small></h3>
    <div class="crew">
      ${creatures.map(c => `<span class="crew-card" title="${c[1]}"><b>${c[0]}</b><small>${c[1]}</small></span>`).join('')}
      ${creatures.length < CREATURES.length ? `<span class="crew-card locked"><b>❓</b><small>Level ${lvl + 1}</small></span>` : ''}
    </div>
    <h3>Badges <small>${earned.length}/${BADGES.length}</small></h3>
    <div class="crew">
      ${BADGES.map(b => `<span class="crew-card ${k.badges.includes(b.id) ? '' : 'locked'}" title="${b.d}"><b>${k.badges.includes(b.id) ? b.e : '🔒'}</b><small>${b.n}</small></span>`).join('')}
    </div>
  </section>`;
};

// ---------- PLANET ----------
screens.planet = () => {
  const k = kid(), op = state.planetOp, o = OPS[op], st = opStats(k, op), fs = familyStats(k, op);
  const fams = Object.keys(fs).map(Number).sort((a, b) => a - b);
  const bossReady = (k.opMissions[op] || 0) >= 2;
  return `
  <header class="topbar"><button class="iconbtn" data-go="home">←</button>
    <div class="who"><b>${o.emoji} ${o.planet}</b><small>${o.name} · ${st.known}/${st.total} known · ${st.mastered} mastered${st.due ? ` · ${st.due} to review` : ''}</small></div>
    <div class="stars">${fmtPct(st.pct)}</div></header>
  <div class="center-col" style="max-width:720px">
    <div class="col">
      ${st.mastered === st.total ? `<div class="unlock" style="--c:${o.color}">🏅 <b>${o.planet} fully mastered!</b><br><button class="btn small" data-cert="${op}">Print certificate</button></div>` : ''}
      <button class="btn primary huge" data-op="${op}">${o.emoji} ${st.placed ? 'Mission' : 'Scan this planet'}</button>
      ${st.placed ? `<div class="row">
        <button class="btn accent" data-lightning="${op}">⚡ Lightning</button>
        <button class="btn ${bossReady ? 'boss' : 'ghost'}" data-boss="${op}" ${bossReady ? '' : 'disabled'}>⚔️ Boss${bossReady ? '' : ` (after ${2 - (k.opMissions[op] || 0)} more mission${2 - (k.opMissions[op] || 0) === 1 ? '' : 's'})`}</button>
      </div>` : ''}
    </div>
    ${st.placed ? `<h3 style="align-self:flex-start">Practice a set</h3>
    <div class="fams">${fams.map(f => { const x = fs[f], pct = x.boxSum / (x.total * 5); return `<button class="fam" data-family="${op}:${f}" style="--p:${pct * 100}%;--c:${o.color}"><b>${o.sym}${f}</b><small>${x.known}/${x.total}</small></button>`; }).join('')}</div>
    <p class="sub">Tap a set to drill just those facts (e.g. the ${o.sym}7s).</p>
    <details class="pop-row" style="width:100%"><summary>🗺️ Your star map <span class="pstat">every fact on this planet</span></summary>${factGrid(k, op)}</details>` : ''}
  </div>`;
};

// ---------- PLAY (placement / mission / lightning) ----------
function numpad(withOk = true) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', withOk ? '✓' : ''];
  return `<div class="numpad">${keys.map(k => k === '' ? '<span></span>' : `<button class="key ${k === '⌫' ? 'del' : k === '✓' ? 'ok' : ''}" data-key="${k}">${k}</button>`).join('')}</div>`;
}

screens.play = () => {
  const p = state.play, o = OPS[p.q.fact.op];
  const total = p.mode === 'lightning' ? null : p.total;
  const teach = p.q.teach && p.mode === 'mission';
  const t = teach ? tip(p.q.fact) : null;
  return `
  <header class="topbar play">
    <button class="iconbtn" data-quit title="Quit">✕</button>
    <div class="progress">
      ${p.mode === 'lightning'
        ? `<div class="timer"><i id="timer-bar" style="width:100%"></i></div><small>⚡ Lightning round · <b id="timer-num">30</b>s</small>`
        : p.mode === 'race'
        ? `<div class="racebar">${p.racers.map((r, i) => `<span class="racer ${i === p.turn ? 'active' : ''}">${r.kid.avatar} ${esc(r.kid.name)} <b>${r.score}</b></span>`).join('<span class="vs">vs</span>')}</div><small>🏁 Round ${p.round + 1}/${p.rounds} · ${esc(p.racers[p.turn].kid.name)}'s turn · ${p.turnLeft} to go</small>`
        : p.mode === 'boss'
        ? `<div class="bossbar"><span class="bossface">${p.boss.e}</span><div class="hp"><i id="boss-hp" style="width:${p.bossHp / p.boss.hp * 100}%"></i></div><span id="hearts">${'❤️'.repeat(p.hearts)}${'🖤'.repeat(3 - p.hearts)}</span></div><small>⚔️ ${p.boss.n} · <b id="boss-num">${p.bossHp}</b> HP</small>`
        : `<div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${p.dots[i] || ''} ${i === p.index ? 'cur' : ''}"></i>`).join('')}</div>
           <small>${p.mode === 'placement' ? '🔭 Scanning ' + o.planet : p.op === 'mix' ? '🌠 Mixed mission · ' + o.name : o.emoji + ' Mission on ' + o.planet + (p.family != null ? ` · the ${o.sym}${p.family}s` : '')}</small>`}
    </div>
    <div class="stars" id="play-stars">⭐ ${p.stars}</div>
  </header>
  <div class="combo" id="combo"></div>
  <div class="qwrap ${teach ? 'teach' : ''}" id="qwrap">
    ${teach ? `<div class="teachtag">✨ New fact!</div>` : ''}
    <div class="question" id="question">${p.q.a} <span class="sym" style="color:${o.color}">${p.q.sym}</span> ${p.q.b} =${teach ? ` <span class="shown">${p.q.ans}</span>` : ''}</div>
    ${teach ? visual(p.q.fact) : ''}
    ${t ? `<div class="tip">💡 ${t}</div>` : ''}
    <div class="answer" id="answer"><span class="caret">&nbsp;</span></div>
    <div class="feedback" id="feedback">${teach ? 'Type the answer to remember it' : ''}</div>
  </div>
  ${numpad(true)}`;
};

function startPlacement(op) {
  const qs = placementQuestions(op);
  state.play = { mode: 'placement', op, qs, dots: [], index: 0, total: qs.length, results: [], stars: 0, combo: 0, input: '', q: qs[0], t0: 0, busy: false };
  go('intro', { intro: { title: `🔭 Scanning ${OPS[op].planet}`, body: `Quick check! Answer ${qs.length} ${OPS[op].name.toLowerCase()} questions as fast as you can. Don't worry about wrong ones — it just tells the ship what to teach you.`, btn: 'Start scan', then: () => { go('play'); startQ(); } } });
}
function startMission(op, family = null) {
  const k = kid();
  const ops = op === 'mix' ? k.unlocked.filter(o => opStats(k, o).placed) : null;
  const sess = ops ? new MixedSession(k, ops) : new Session(k, op, family);
  state.play = { mode: 'mission', op, family, sess, dots: [], index: 0, total: MISSION_LENGTH, results: [], stars: 0, combo: 0, maxCombo: 0, input: '', q: sess.next(), t0: 0, busy: false, boxUps: 0, newFacts: 0, beforeStats: ops ? null : opStats(k, op) };
  go('play'); startQ();
}
function startRace(ids) {
  const racers = ids.map(id => { const k = store.kid(id); const op = suggestedOp(k); const placedOp = opStats(k, op).placed ? op : k.unlocked.filter(o => opStats(k, o).placed).pop(); return { kid: k, op: placedOp, sess: new Session(k, placedOp), score: 0, correct: 0, n: 0, stars: 0 }; });
  state.play = { mode: 'race', racers, turn: 0, round: 0, rounds: 2, perTurn: 5, turnLeft: 5, op: racers[0].op, sess: racers[0].sess, index: 0, results: [], dots: null, stars: 0, combo: 0, maxCombo: 0, input: '', q: null, t0: 0, busy: false };
  raceTurnIntro();
}
function raceTurnIntro() {
  const p = state.play, r = p.racers[p.turn];
  state.kid = r.kid; p.op = r.op; p.sess = r.sess; p.stars = r.stars; p.combo = 0; p.turnLeft = p.perTurn; p.q = r.sess.next();
  go('intro', { intro: { title: `${r.kid.avatar} ${esc(r.kid.name)}'s turn!`, body: `${p.perTurn} questions on ${OPS[r.op].planet}. Fast and right = more points. Hand over the device!`, btn: p.round === 0 && p.turn === 0 ? '🏁 Go!' : 'Ready!', then: () => { go('play'); startQ(); } } });
}
function raceAfterAnswer(correct, ms) {
  const p = state.play, r = p.racers[p.turn];
  r.n++; if (correct) { r.correct++; r.score += ms <= speedLimit(p.op, r.kid) ? 3 : 2; }
  r.stars = p.stars; p.turnLeft--;
}
function raceNext() {
  const p = state.play;
  if (p.turnLeft > 0) { p.q = p.racers[p.turn].sess.next(); render(); startQ(); return; }
  p.turn++;
  if (p.turn >= p.racers.length) { p.turn = 0; p.round++; }
  if (p.round >= p.rounds) return finishRace();
  raceTurnIntro();
}
function finishRace() {
  const p = state.play, sorted = [...p.racers].sort((a, b) => b.score - a.score), tie = sorted[0].score === sorted[1].score;
  for (const r of p.racers) { ensureKid(r.kid); r.kid.stars += r.stars; r.kid.xp += r.stars; touchDaily(r.kid, false); }
  if (!tie) { sorted[0].kid.stars += 50; sorted[0].kid.xp += 50; }
  for (const r of p.racers) checkUnlocks(r.kid);
  save(); sound.fanfare(); confetti({ count: 180 });
  state.kid = null;
  go('summary', { summary: { title: tie ? '🤝 It\'s a tie!' : `🏆 ${esc(sorted[0].kid.name)} wins!`, op: p.racers[0].op, lines: p.racers.map(r => `${r.kid.avatar} <b>${esc(r.kid.name)}</b>: ${r.score} points · ${r.correct}/${r.n} correct · +${r.stars}${!tie && r === sorted[0] ? ' +50 winner bonus' : ''} ⭐`), stars: p.racers.reduce((a, r) => a + r.stars, 0) + (tie ? 0 : 50), unlocked: [], badges: [], nextBtn: 'Race again', nextOp: 'race', raceIds: p.racers.map(r => r.kid.id), lightning: false } });
}
const BOSSES = [['👾', 'Glitch', 12], ['🐙', 'Kraken', 15], ['🤖', 'Mega-Bot', 18], ['🐉', 'Number Dragon', 22], ['👹', 'Chaos King', 26]];
function startBoss(op) {
  const k = kid(); ensureKid(k);
  const lvl = Math.min(BOSSES.length - 1, k.best.bosses || 0);
  const [e, n, hp] = BOSSES[lvl];
  const sess = new Session(k, op), pool = bossPool(k, op);
  const pick = prev => { let f; do f = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && prev && f.id === prev); return makeQuestion(f); };
  state.play = { mode: 'boss', op, sess, pool, pick, boss: { e, n, hp }, bossHp: hp, hearts: 3, index: 0, results: [], stars: 0, combo: 0, maxCombo: 0, input: '', q: pick(null), t0: 0, busy: false };
  go('intro', { intro: { title: `${e} ${n} appears!`, body: `Every correct answer hits the boss. Fast answers are critical hits (double damage)! Wrong answers cost you a heart — lose all 3 and the boss escapes. Take down ${hp} HP to win!`, btn: '⚔️ Fight!', then: () => { go('play'); startQ(); } } });
}
function startLightning(op) {
  const pool = lightningPool(kid(), op);
  state.play = { mode: 'lightning', op, pool, index: 0, results: [], stars: 0, combo: 0, maxCombo: 0, input: '', q: makeQuestion(pool[Math.floor(Math.random() * pool.length)]), t0: 0, busy: false, endAt: Date.now() + 30000 };
  go('play'); startQ();
  clearInterval(state.lightningTimer);
  state.lightningTimer = setInterval(() => {
    if (state.screen !== 'play' || state.play.mode !== 'lightning') return clearInterval(state.lightningTimer);
    const left = Math.max(0, state.play.endAt - Date.now());
    const bar = $('#timer-bar'), num = $('#timer-num');
    if (bar) bar.style.width = (left / 300) + '%';
    if (num) num.textContent = Math.ceil(left / 1000);
    if (left <= 0) { clearInterval(state.lightningTimer); finishLightning(); }
  }, 100);
}

screens.intro = () => `
  <div class="center-col narrow">
    <h2>${state.intro.title}</h2>
    <p class="sub">${state.intro.body}</p>
    <button class="btn primary huge" data-intro-go>${state.intro.btn}</button>
    <button class="link" data-go="home">← Back to base</button>
  </div>`;

function startQ() {
  const p = state.play; p.t0 = performance.now(); p.input = ''; p.busy = false;
  p.fixing = !!(p.q.teach && p.mode === 'mission');
  speak(p.fixing ? `New fact. ${speakText(p.q)} equals ${p.q.ans}` : speakText(p.q));
}

function onKey(k) {
  if (state.screen === 'pin' || state.screen === 'parentpin') return pinKey(k);
  if (state.screen !== 'play') return;
  const p = state.play; if (p.busy) return;
  sound.tap();
  if (p.fixing) return fixKey(k);
  if (k === '⌫') p.input = p.input.slice(0, -1);
  else if (k === '✓') { if (p.input !== '') return submit(); }
  else if (/^\d$/.test(k)) { if (p.input.length < 3) p.input += k; }
  const ans = $('#answer'); if (ans) ans.innerHTML = p.input === '' ? '<span class="caret">&nbsp;</span>' : esc(p.input);
  // auto-submit when the answer has the right number of digits
  if (p.input.length && p.input.length >= String(p.q.ans).length) submit();
}

// After a miss (missions & boss fights) the kid must type the correct answer before moving on.
function fixKey(k) {
  const p = state.play, target = String(p.q.ans);
  if (k === '⌫') p.input = p.input.slice(0, -1);
  else if (/^\d$/.test(k) && p.input.length < target.length) p.input += k;
  else return;
  const ans = $('#answer'); if (ans) ans.innerHTML = p.input === '' ? '<span class="caret">&nbsp;</span>' : esc(p.input);
  if (p.input.length === target.length) {
    if (p.input === target) { if (p.q.teach) p.dots.push('teach'); p.fixing = false; p.busy = true; ans.classList.remove('bad'); ans.classList.add('good'); sound.correct(0); setTimeout(nextQ, 350); }
    else { p.input = ''; $('#qwrap').classList.remove('wrong'); void $('#qwrap').offsetWidth; $('#qwrap').classList.add('wrong'); sound.wrong(); setTimeout(() => { if (ans && p.fixing) ans.innerHTML = '<span class="caret">&nbsp;</span>'; }, 250); }
  }
}

function submit() {
  const p = state.play; if (p.busy) return;
  p.busy = true;
  const ms = performance.now() - p.t0, val = parseInt(p.input, 10), correct = val === p.q.ans;
  const k = kid(), fast = correct && ms <= speedLimit(p.q.fact.op, k);
  try { navigator.vibrate?.(correct ? 15 : [50, 40, 50]); } catch {}
  p.results.push({ fact: p.q.fact, correct, ms }); if (p.dots) p.dots.push(correct ? 'ok' : 'bad');
  const fb = $('#feedback'), qw = $('#qwrap'), ans = $('#answer');
  let gained = 0;
  if (correct) {
    p.combo++; p.maxCombo = Math.max(p.maxCombo || 0, p.combo);
    if (p.mode === 'mission' || p.mode === 'boss' || p.mode === 'race') {
      const r = p.sess.answer(p.q, correct, ms, p.combo); gained = r.stars;
      if (r.boxAfter > r.boxBefore) p.boxUps++;
      if (r.boxBefore === 0 && r.boxAfter > 0) p.newFacts++;
    } else if (p.mode === 'lightning') gained = 5 * (p.combo >= 10 ? 3 : p.combo >= 5 ? 2 : 1);
    else gained = 5;
    p.stars += gained;
    sound.correct(p.combo); if (fast) sound.fast();
    if (p.combo > 0 && p.combo % 5 === 0) { sound.combo(); confetti({ count: 60 }); }
    qw.classList.add('right'); ans.classList.add('good');
    const r = ans.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2);
    fb.innerHTML = `<span class="pop">${fast ? '⚡ Speedy!' : ['Nice!', 'Yes!', 'Got it!', 'Boom!', 'Correct!'][Math.floor(Math.random() * 5)]}</span> <span class="gain">+${gained} ⭐</span>`;
    if (p.mode === 'boss') {
      const dmg = fast ? 2 : 1; p.bossHp = Math.max(0, p.bossHp - dmg);
      fb.innerHTML = `<span class="pop">${fast ? '💥 CRITICAL HIT! −2' : '🗡️ Hit! −1'}</span> <span class="gain">+${gained} ⭐</span>`;
      $('#boss-hp').style.width = (p.bossHp / p.boss.hp * 100) + '%'; $('#boss-num').textContent = p.bossHp;
      $('.bossface').classList.add('hurt'); setTimeout(() => $('.bossface')?.classList.remove('hurt'), 400);
    }
  } else {
    if (p.mode === 'boss') { p.hearts--; $('#hearts').textContent = '❤️'.repeat(p.hearts) + '🖤'.repeat(3 - p.hearts); }
    p.combo = 0;
    if (p.mode === 'mission' || p.mode === 'boss' || p.mode === 'race') p.sess.answer(p.q, false, ms, 0);
    sound.wrong();
    qw.classList.add('wrong'); ans.classList.add('bad');
    fb.innerHTML = `<span class="pop">Not quite — <b>${p.q.text} = ${p.q.ans}</b></span>`;
    if (p.mode === 'race') raceAfterAnswer(false, ms);
    if (p.mode === 'mission' || p.mode === 'boss') {
      // show the answer, then hand control back so they type it
      setTimeout(() => { if (state.screen !== 'play' || state.play !== p) return; p.input = ''; p.busy = false; p.fixing = true; ans.innerHTML = '<span class="caret">&nbsp;</span>'; fb.innerHTML = `<span class="pop">Type it: <b>${p.q.text} = ${p.q.ans}</b></span>`; speak(`${speakText(p.q)} equals ${p.q.ans}`); }, 1100);
      $('#play-stars').textContent = `⭐ ${p.stars}`; const c = $('#combo'); c.textContent = ''; c.className = 'combo';
      if (p.mode === 'boss' && p.hearts <= 0) return setTimeout(() => finishBoss(false), 1700);
      return;
    }
  }
  $('#play-stars').textContent = `⭐ ${p.stars}`;
  const combo = $('#combo');
  combo.textContent = p.combo >= 3 ? `🔥 ${p.combo} combo!` : '';
  combo.className = 'combo' + (p.combo >= 3 ? ' show' : '');
  if (p.mode === 'race') raceAfterAnswer(correct, ms);
  if (p.mode === 'boss' && (p.bossHp <= 0 || p.hearts <= 0)) return setTimeout(() => finishBoss(p.bossHp <= 0), correct ? 700 : 1700);
  setTimeout(nextQ, correct ? (p.mode === 'lightning' ? 300 : 450) : 1700);
}

function nextQ() {
  const p = state.play;
  p.index++;
  if (p.mode === 'placement') { if (p.index >= p.total) return finishPlacement(); p.q = p.qs[p.index]; }
  else if (p.mode === 'mission') { if (p.index >= p.total) return finishMission(); p.q = p.sess.next(); }
  else if (p.mode === 'boss') { p.q = p.pick(p.q.fact.id); }
  else if (p.mode === 'race') { return raceNext(); }
  else { if (Date.now() >= p.endAt) return finishLightning(); let f; do f = p.pool[Math.floor(Math.random() * p.pool.length)]; while (p.pool.length > 1 && f.id === p.q.fact.id); p.q = makeQuestion(f); }
  render(); startQ();
}

function finishPlacement() {
  const p = state.play, k = kid();
  applyPlacement(k, p.op, p.results);
  k.stars += p.stars; k.xp += p.stars;
  const unlocked = checkUnlocks(k); save();
  const st = opStats(k, p.op);
  const correct = p.results.filter(r => r.correct).length;
  go('summary', { summary: { title: '🔭 Scan complete!', op: p.op, lines: [
    `You got <b>${correct}/${p.results.length}</b> right.`,
    `${OPS[p.op].planet} is <b>${fmtPct(st.known / st.total)}</b> explored already.`,
    st.known / st.total >= 0.85 ? `You already know ${OPS[p.op].name.toLowerCase()}! We'll keep checking now and then.` : `Your ship will teach you the rest, a few facts at a time.`,
  ], stars: p.stars, unlocked, nextBtn: st.known / st.total >= 0.85 && unlocked.length ? `Fly to ${OPS[unlocked[0]].planet}` : `Start first mission`, nextOp: unlocked[0] || p.op, lightning: false } });
}

function finishMission() {
  const p = state.play, k = kid();
  ensureKid(k); touchDaily(k, true); if (p.op !== 'mix') k.opMissions[p.op] = (k.opMissions[p.op] || 0) + 1;
  let bonus = 0;
  if (k.daily.missions === DAILY_GOAL) bonus += 50;                       // daily goal hit
  if (k.daily.missions === 1 && k.streak.count > 1) bonus += Math.min(100, k.streak.count * 10); // streak bonus on first mission of the day
  p.stars += bonus;
  k.stars += p.stars; k.xp += p.stars; k.missions++;
  const correct = p.results.filter(r => r.correct).length;
  const before = levelFor(k.xp - p.stars), after = levelFor(k.xp);
  k.history.push({ t: Date.now(), op: p.op, n: p.results.length, c: correct, stars: p.stars });
  if (k.history.length > 400) k.history.shift();
  const unlocked = checkUnlocks(k); save();
  const st = p.op === 'mix' ? null : opStats(k, p.op), bst = p.beforeStats;
  const fastest = Math.min(...p.results.filter(r => r.correct).map(r => r.ms));
  const lines = [
    `<b>${correct}/${p.results.length}</b> correct · best combo <b>${p.maxCombo}</b>${isFinite(fastest) ? ` · fastest <b>${(fastest / 1000).toFixed(1)}s</b>` : ''}`,
    bst ? `${OPS[p.op].planet}: <b>${fmtPct(bst.pct)} → ${fmtPct(st.pct)}</b> explored` + (p.newFacts ? ` · ${p.newFacts} new fact${p.newFacts > 1 ? 's' : ''} learned` : '') : `🌠 Mixed mission across ${p.sess.ops.length} planets` + (p.newFacts ? ` · ${p.newFacts} new fact${p.newFacts > 1 ? 's' : ''} learned` : ''),
  ];
  if (after > before) lines.push(`🎉 <b>Level ${after}!</b> ${CREATURES[after - 2] ? `${CREATURES[after - 2][0]} <b>${CREATURES[after - 2][1]}</b> joined your crew!` : ''}`);
  if (bonus) lines.push(`🎁 Bonus <b>+${bonus} ⭐</b> ${k.daily.missions === DAILY_GOAL ? 'for finishing today\'s goal' : `for your ${k.streak.count}-day streak`}!`);
  const badges = checkBadges(k, { mode: 'mission', correct, n: p.results.length, maxCombo: p.maxCombo, fastest });
  save();
  go('summary', { summary: { title: '🏁 Mission complete!', op: p.op, lines, stars: p.stars, unlocked, badges, levelUp: after > before, nextBtn: p.op === 'mix' ? 'Another mixed mission' : 'Another mission', nextOp: p.op, family: p.family, lightning: p.op !== 'mix' } });
}

function finishLightning() {
  const p = state.play, k = kid();
  if (state.screen !== 'play') return;
  k.stars += p.stars; k.xp += p.stars;
  const correct = p.results.filter(r => r.correct).length;
  const record = correct > (k.best.lightning || 0);
  if (record) k.best.lightning = correct;
  touchDaily(k, false);
  const badges = checkBadges(k, { mode: 'lightning', maxCombo: p.maxCombo, fastest: Math.min(...p.results.filter(r => r.correct).map(r => r.ms)) });
  save();
  go('summary', { summary: { title: '⚡ Lightning over!', op: p.op, lines: [
    `<b>${correct}</b> correct in 30 seconds${record ? ' — <b>NEW RECORD!</b> 🏆' : ` · your record is ${k.best.lightning}`}`,
    `Best combo <b>${p.maxCombo}</b>`,
  ], stars: p.stars, unlocked: [], badges, levelUp: record, nextBtn: 'Another mission', nextOp: p.op, lightning: false } });
}

function finishBoss(won) {
  const p = state.play, k = kid(); ensureKid(k);
  if (won) { p.stars += 100; k.best.bosses = (k.best.bosses || 0) + 1; sound.fanfare(); confetti({ count: 200 }); }
  k.stars += p.stars; k.xp += p.stars; touchDaily(k, false);
  const correct = p.results.filter(r => r.correct).length;
  const unlocked = checkUnlocks(k);
  const badges = checkBadges(k, { mode: 'boss', maxCombo: p.maxCombo, fastest: Math.min(...p.results.filter(r => r.correct).map(r => r.ms)) });
  save();
  const nextBoss = BOSSES[Math.min(BOSSES.length - 1, k.best.bosses || 0)];
  go('summary', { summary: { title: won ? `🏆 ${p.boss.n} defeated!` : `💨 ${p.boss.n} escaped…`, op: p.op, lines: [
    won ? `Victory bonus <b>+100 ⭐</b> · ${correct} hits landed` : `You landed <b>${correct}</b> hits. Train a bit more and try again!`,
    won ? `Next challenger: ${nextBoss[0]} <b>${nextBoss[1]}</b> (${nextBoss[2]} HP)` : `Best combo <b>${p.maxCombo}</b>`,
  ], stars: p.stars, unlocked, badges, levelUp: won, nextBtn: won ? 'Another mission' : 'Train with a mission', nextOp: p.op, lightning: false, boss: p.op } });
}

screens.summary = () => {
  const s = state.summary;
  return `
  <div class="center-col narrow summary">
    <h2>${s.title}</h2>
    <div class="bigstars">+${s.stars} ⭐</div>
    ${s.lines.map(l => `<p class="line">${l}</p>`).join('')}
    ${s.unlocked.map(op => `<div class="unlock" style="--c:${OPS[op].color}">${OPS[op].emoji} <b>${OPS[op].planet} unlocked!</b><br><small>${OPS[op].name} is ready to explore</small></div>`).join('')}
    ${(s.badges || []).map(b => `<div class="unlock badge" style="--c:#fde047">${b.e} <b>New badge: ${b.n}</b><br><small>${b.d}</small></div>`).join('')}
    <div class="col">
      <button class="btn primary huge" ${s.nextOp === 'race' ? `data-race-go="${s.raceIds.join(',')}"` : s.nextOp === 'mix' ? 'data-mixed' : s.family != null ? `data-family="${s.op}:${s.family}"` : `data-op="${s.nextOp}"`}>${s.nextOp === 'race' ? '🏁' : s.nextOp === 'mix' ? '🌠' : OPS[s.nextOp].emoji} ${s.nextBtn}${s.family != null ? ` (${OPS[s.op].sym}${s.family}s)` : ''}</button>
      ${s.boss ? `<button class="btn boss" data-boss="${s.boss}">⚔️ Rematch</button>` : ''}
      ${s.lightning ? `<button class="btn accent" data-lightning="${s.op}">⚡ Lightning round (30s bonus)</button>` : ''}
      <button class="btn ghost" data-go="${s.nextOp === 'race' ? 'login' : 'home'}">🏠 Back to base</button>
    </div>
  </div>`;
};

screens.racepick = () => {
  const kids = store.kids().filter(k => OP_ORDER.some(op => opStats(k, op).placed)), sel = state.raceSel || [];
  return `
  <div class="center-col">
    <h2>🏁 Sibling Race</h2>
    <p class="sub">Pick two players. Each answers on their own planet, so it's fair. ${state.play?.rounds || 2} rounds of 5 questions — fast & right scores 3, right scores 2.</p>
    <div class="kid-grid">${kids.map(k => `<button class="kid-card ${sel.includes(k.id) ? 'sel' : ''}" data-race-pick="${k.id}"><span class="avatar">${k.avatar}</span><span class="kname">${esc(k.name)}</span><span class="lvl">${OPS[suggestedOp(k)].planet}</span></button>`).join('')}</div>
    <div class="row"><button class="btn ghost" data-go="login">Cancel</button><button class="btn primary" data-race-go="${sel.join(',')}" ${sel.length === 2 ? '' : 'disabled'}>Start race!</button></div>
  </div>`;
};

screens.certificate = () => {
  const k = kid(), op = state.certOp, o = OPS[op], st = opStats(k, op);
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return `
  <header class="topbar noprint"><button class="iconbtn" data-go="planet">←</button><div class="who"><b>Certificate</b></div><button class="btn small" data-print>🖨️ Print / Save PDF</button></header>
  <div class="cert">
    <div class="cert-inner">
      <div class="cert-emoji">${o.emoji}</div>
      <div class="cert-title">Certificate of Mastery</div>
      <div class="cert-sub">This certifies that</div>
      <div class="cert-name">${k.avatar} ${esc(k.name)}</div>
      <div class="cert-sub">has mastered every ${o.name.toLowerCase()} fact on</div>
      <div class="cert-planet">${o.planet}</div>
      <div class="cert-stats">${st.total} facts · answered fast and correctly on many separate days</div>
      <div class="cert-date">${date} · Math Quest</div>
    </div>
  </div>`;
};

// ---------- PARENT ----------
screens.parentpin = () => `
  <div class="center-col narrow">
    <h2>${state.data.parentPin ? 'Parent PIN' : 'Create a parent PIN'}</h2>
    <p class="sub">${state.data.parentPin ? 'Enter your 4-digit PIN' : 'Choose a 4-digit PIN to protect the parent zone'}</p>
    <div class="pin-dots" id="pin-dots">${'<span></span>'.repeat(4)}</div>
    <p class="err" id="pin-err"></p>
    ${numpad(false)}
    <button class="link" data-go="login">← Back</button>
  </div>`;

screens.parent = () => {
  const kids = store.kids();
  return `
  <header class="topbar"><button class="iconbtn" data-go="login">←</button><div class="who"><b>Parent zone</b></div></header>
  <div class="parent">
    <p class="sub left">How it works: each kid gets a quick placement scan per operation, then the app drills facts they don't know (spaced repetition: a fact must be answered quickly and correctly on several separate days to count as mastered, and mastered facts are re-checked every few weeks). The next operation unlocks at 85% known.</p>
    ${kids.length ? '' : '<p class="sub">No players yet.</p>'}
    ${kids.map(k => {
      const recent = k.history.slice(-7), rc = recent.reduce((a, h) => a + h.c, 0), rn = recent.reduce((a, h) => a + h.n, 0);
      return `<section class="pkid" data-kid="${k.id}">
        <h3>${k.avatar} ${esc(k.name)} <small>Level ${levelFor(k.xp)} · ⭐ ${k.stars} · ${k.missions} missions${rn ? ` · last 7 missions ${Math.round(rc / rn * 100)}% correct` : ''}</small></h3>
        <div class="week">${Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 86400e3); const ds = localDate(d); const n = k.history.filter(h => localDate(h.t) === ds).length; return `<span class="day ${n ? 'on' : ''}" title="${n} missions"><b>${n || ''}</b><small>${['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</small></span>`; }).join('')}<small class="sub left" style="margin:0 0 0 8px">missions per day · 🔥 ${(k.streak || {}).count || 0}-day streak · ⚔️ ${(k.best || {}).bosses || 0} bosses</small></div>
        ${weeklyRow(k)}
        <div class="pops">
        ${OP_ORDER.map(op => {
          const st = opStats(k, op), locked = !k.unlocked.includes(op), o = OPS[op];
          return `<details class="pop-row" ${op === suggestedOp(k) ? 'open' : ''}>
            <summary><span style="color:${o.color}">${o.emoji} ${o.name}</span>
              <span class="pstat">${locked ? '🔒 locked' : !st.placed ? 'not scanned yet' : `${fmtPct(st.pct)} · ${st.known}/${st.total} known · ${st.mastered} mastered · ${st.due} due`}</span></summary>
            ${factGrid(k, op)}
            <div class="row wrap">
              ${locked ? `<button class="btn small" data-unlock="${k.id}:${op}">Unlock now</button>` : ''}
              ${st.placed ? `<button class="btn small ghost" data-rescan="${k.id}:${op}">Reset & re-scan</button>` : ''}
            </div>
          </details>`;
        }).join('')}
        </div>
        <div class="row wrap" style="align-items:center;gap:6px"><small class="sub left" style="margin:0">Speed needed for "fast":</small>
          ${['relaxed', 'normal', 'fast'].map(sp => `<button class="btn small ${(k.speed || 'normal') === sp ? '' : 'ghost'}" data-speed="${k.id}:${sp}">${sp}</button>`).join('')}
          <small class="sub left" style="margin:0">(relaxed ≈ 6s for +/−, 10s for ×/÷ · normal 4s/6s · fast 3s/4s)</small></div>
        <div class="row wrap">
          <button class="btn small ghost" data-setpin="${k.id}">Change PIN</button>
          <button class="btn small danger" data-delkid="${k.id}">Delete player</button>
        </div>
      </section>`;
    }).join('')}
    <section class="pkid" id="sync-section">
      <h3>☁️ Family Sync <small>${syncStatusText()}</small></h3>
      ${sync.configured() ? `
        <p class="sub left">Progress syncs between every device that uses family code <b style="color:#fff">${esc(sync.cfg.code)}</b>. Enter the same Supabase URL, key and code on the other devices.</p>
        <div class="row wrap"><button class="btn small" data-syncnow>Sync now</button><button class="btn small ghost" data-copycode>Copy family code</button><button class="btn small ghost" data-syncedit>Edit settings</button><button class="btn small danger" data-syncoff>Turn off</button></div>`
      : `<p class="sub left">Optional: keep every kid's progress in sync across iPads, phones and computers. Needs a free <a href="https://supabase.com" target="_blank" rel="noopener" style="color:#fff">Supabase</a> project — one-time setup, instructions in the README.</p>
        ${state.syncEdit ? '' : '<button class="btn small" data-syncedit>Set up sync</button>'}`}
      ${state.syncEdit ? `<div class="col" style="margin-top:8px">
        <label class="field"><span>Supabase project URL</span><input id="sy-url" placeholder="https://xxxx.supabase.co" value="${esc(sync.cfg?.url || '')}" autocapitalize="off" autocomplete="off"></label>
        <label class="field"><span>Supabase anon (public) key</span><input id="sy-key" placeholder="eyJ…" value="${esc(sync.cfg?.key || '')}" autocapitalize="off" autocomplete="off"></label>
        <label class="field"><span>Family code (same on every device — make it long & secret)</span><input id="sy-code" placeholder="e.g. foval-kids-7h3k9q" value="${esc(sync.cfg?.code || '')}" autocapitalize="off" autocomplete="off"></label>
        <div class="row wrap"><button class="btn small" data-syncsave>Save & sync</button><button class="btn small ghost" data-gencode>Generate code</button><button class="btn small ghost" data-synccancel>Cancel</button></div>
        <p class="err" id="sy-err">${esc(sync.status.error || '')}</p></div>` : ''}
    </section>
    <section class="pkid">
      <h3>Backup & devices</h3>
      <p class="sub left">Progress is saved on this device. To move it to another device (or keep a backup), export here and import there.</p>
      <div class="row wrap">
        <button class="btn small" data-export>⬇︎ Export backup</button>
        <label class="btn small ghost">⬆︎ Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label>
        <button class="btn small ghost" data-changeparentpin>Change parent PIN</button>
      </div>
    </section>
  </div>`;
};

function factGrid(k, op) {
  const o = OPS[op], d = opData(k, op), M = o.max;
  const facts = allFacts(op); const byKey = {};
  for (const f of facts) byKey[f.id] = f;
  // rows/cols = operands; for sub/div rows are the "answer" a and cols the subtracted/divisor b
  const cols = op === 'div' ? Array.from({ length: M }, (_, i) => i + 1) : Array.from({ length: M + 1 }, (_, i) => i);
  const rows = Array.from({ length: M + 1 }, (_, i) => i);
  const cell = (r, c) => {
    let id;
    if (op === 'add') id = `${Math.min(r, c)}+${Math.max(r, c)}`;
    else if (op === 'mul') id = `${Math.min(r, c)}x${Math.max(r, c)}`;
    else if (op === 'sub') id = `${r + c}-${c}`;
    else id = `${r * c}/${c}`;
    const f = byKey[id]; if (!f) return '<i></i>';
    const box = d.facts[id]?.box || 0;
    return `<i class="b${box}" title="${f.a} ${o.sym} ${f.b} = ${f.ans}  (box ${box}/5)"></i>`;
  };
  return `<div class="grid-wrap"><div class="fgrid" style="grid-template-columns: 1.6em repeat(${cols.length}, 1fr)">
    <b></b>${cols.map(c => `<b>${c}</b>`).join('')}
    ${rows.map(r => `<b>${r}</b>${cols.map(c => cell(r, c)).join('')}`).join('')}
  </div>
  <div class="legend">${op === 'add' || op === 'mul' ? 'row ' + o.sym + ' column' : op === 'sub' ? 'row = answer, column = number subtracted' : 'row = answer, column = divisor'} · <i class="b0"></i>unknown <i class="b1"></i><i class="b2"></i>learning <i class="b3"></i><i class="b4"></i>known <i class="b5"></i>mastered</div></div>`;
}

// ---------- PIN handling ----------
let pinBuf = '';
function pinKey(k) {
  sound.tap();
  if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
  else if (/^\d$/.test(k) && pinBuf.length < 4) pinBuf += k;
  $('#pin-dots').querySelectorAll('span').forEach((s, i) => s.classList.toggle('on', i < pinBuf.length));
  if (pinBuf.length === 4) {
    const entered = pinBuf; pinBuf = '';
    setTimeout(() => {
      if (state.pinMode === 'kid') {
        if (entered === state.pinKid.pin) login(state.pinKid);
        else { $('#pin-err').textContent = 'Oops, try again'; $('#pin-dots').classList.add('shake'); setTimeout(() => render(), 400); }
      } else if (state.pinMode === 'parent') {
        if (!state.data.parentPin) { state.data.parentPin = entered; save(); go('parent'); }
        else if (entered === state.data.parentPin) go('parent');
        else { $('#pin-err').textContent = 'Wrong PIN'; setTimeout(() => render(), 400); }
      } else if (state.pinMode === 'setparent') { state.data.parentPin = entered; save(); go('parent'); }
      else if (state.pinMode === 'setkid') { state.pinKid.pin = entered; save(); go('parent'); }
    }, 120);
  }
}
function login(k) { state.kid = k; state.data.currentKid = k.id; save(); go('home'); }

// ---------- events ----------
function wire() {
  const sel = document.querySelector('.av.sel');
  app.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { app.querySelectorAll('.av').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); });
  const nameInput = $('#nk-name'); if (nameInput) setTimeout(() => nameInput.focus(), 50);
  const imp = $('#import-file');
  if (imp) imp.onchange = async () => {
    const f = imp.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); state.data = store.data; alert('Backup imported!'); go('parent'); }
    catch (e) { alert('Could not import: ' + e.message); }
  };
}
app.addEventListener('click', e => {
  const t = e.target.closest('button, label'); if (!t) return;
  sound.unlock();
  const d = t.dataset;
  if (d.key !== undefined) return onKey(d.key);
  if (d.go) { pinBuf = ''; return go(d.go); }
  if (d.login) { const k = store.kid(d.login); pinBuf = ''; return k.pin ? go('pin', { pinKid: k, pinMode: 'kid' }) : login(k); }
  if (d.addkid !== undefined) return go('newkid');
  if (d.createkid !== undefined) {
    const name = $('#nk-name').value.trim(), pin = $('#nk-pin').value.trim(), avatar = document.querySelector('.av.sel')?.dataset.av || AVATARS[0];
    if (!name) { $('#nk-name').focus(); $('#nk-name').classList.add('shake'); return; }
    if (pin && !/^\d{4}$/.test(pin)) { $('#nk-pin').focus(); $('#nk-pin').classList.add('shake'); return; }
    const k = store.addKid({ name, avatar, pin }); return login(k);
  }
  if (d.parent !== undefined) { pinBuf = ''; return go('parentpin', { pinMode: 'parent' }); }
  if (d.sound !== undefined) { state.data.settings.sound = !state.data.settings.sound; sound.setEnabled(state.data.settings.sound); save(); return render(); }
  if (d.op) { const k = kid(); if (!k) return go('login'); const st = opStats(k, d.op); return st.placed ? startMission(d.op) : startPlacement(d.op); }
  if (d.planet) { const k = kid(); if (!k) return go('login'); return opStats(k, d.planet).placed ? go('planet', { planetOp: d.planet }) : startPlacement(d.planet); }
  if (d.mixed !== undefined) return startMission('mix');
  if (d.race !== undefined) return go('racepick', { raceSel: [] });
  if (d.racePick) { const sel = state.raceSel || []; state.raceSel = sel.includes(d.racePick) ? sel.filter(x => x !== d.racePick) : [...sel, d.racePick].slice(-2); return render(); }
  if (d.raceGo) { const ids = d.raceGo.split(',').filter(Boolean); if (ids.length === 2) return startRace(ids); return; }
  if (d.cert) return go('certificate', { certOp: d.cert, planetOp: d.cert });
  if (d.print !== undefined) return window.print();
  if (d.syncedit !== undefined) { state.syncEdit = true; return render(); }
  if (d.synccancel !== undefined) { state.syncEdit = false; return render(); }
  if (d.gencode !== undefined) { $('#sy-code').value = 'family-' + Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 8); return; }
  if (d.syncsave !== undefined) {
    const cfg = { url: $('#sy-url').value.trim(), key: $('#sy-key').value.trim(), code: $('#sy-code').value.trim() };
    if (!/^https:\/\/.+/.test(cfg.url) || !cfg.key || cfg.code.length < 6) { $('#sy-err').textContent = 'Please fill in all three (family code at least 6 characters).'; return; }
    sync.saveCfg(cfg); state.syncEdit = false; render();
    sync.pullAndMerge(state.data).then(changed => { if (changed) { save(); refreshKid(); } if (sync.status.state === 'ok') { state.syncEdit = false; } else state.syncEdit = true; render(); });
    return;
  }
  if (d.syncnow !== undefined) { sync.pullAndMerge(state.data).then(changed => { if (changed) { save(); refreshKid(); } render(); }); return render(); }
  if (d.syncoff !== undefined) { if (!confirm('Turn off Family Sync on this device? (Data stays here and on the server.)')) return; sync.saveCfg(null); return render(); }
  if (d.copycode !== undefined) { navigator.clipboard?.writeText(sync.cfg.code).then(() => { t.textContent = 'Copied!'; setTimeout(() => render(), 1200); }); return; }
  if (d.speed) { const [id, sp] = d.speed.split(':'); store.kid(id).speed = sp; save(); return render(); }
  if (d.install !== undefined) { const ev = state.installEvent; if (ev) { ev.prompt(); state.installEvent = null; render(); } return; }
  if (d.dismissInstall !== undefined) { localStorage.setItem('mq.installhint', '1'); return render(); }
  if (d.family) { const [op, f] = d.family.split(':'); return startMission(op, Number(f)); }
  if (d.boss) return startBoss(d.boss);
  if (d.speak !== undefined) { kid().speak = !kid().speak; save(); if (kid().speak) speak('Reading questions out loud'); return render(); }
  if (d.lightning) return startLightning(d.lightning);
  if (d.introGo !== undefined) return state.intro.then();
  if (d.quit !== undefined) { if (state.play.mode === 'race') { if (confirm('End the race?')) { state.kid = null; go('login'); } return; } if (state.play.mode === 'placement' || confirm('Quit this mission? Progress so far is saved.')) { if (state.play.mode === 'mission' || state.play.mode === 'boss') { kid().stars += state.play.stars; kid().xp += state.play.stars; checkUnlocks(kid()); save(); } return go('home'); } return; }
  if (d.unlock) { const [id, op] = d.unlock.split(':'); const k = store.kid(id); if (!k.unlocked.includes(op)) k.unlocked.push(op); save(); return render(); }
  if (d.rescan) { const [id, op] = d.rescan.split(':'); if (!confirm(`Reset all ${OPS[op].name} progress for ${store.kid(id).name}? They'll be re-scanned next time.`)) return; store.kid(id).ops[op] = { facts: {}, placed: false }; save(); return render(); }
  if (d.delkid) { const k = store.kid(d.delkid); if (!confirm(`Delete ${k.name} and all their progress? This cannot be undone.`)) return; store.removeKid(k.id); if (state.kid?.id === k.id) state.kid = null; return render(); }
  if (d.setpin) { pinBuf = ''; return go('pin', { pinKid: store.kid(d.setpin), pinMode: 'setkid' }); }
  if (d.changeparentpin !== undefined) { pinBuf = ''; state.pinMode = 'setparent'; return go('parentpin'); }
  if (d.export !== undefined) {
    const name = `mathquest-backup-${today()}.json`, json = store.exportJSON();
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Math Quest backup' }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); return;
  }
});
document.addEventListener('mq:saveerror', () => { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); } t.textContent = '⚠️ Could not save progress — storage is full or blocked (private browsing?)'; t.className = 'show'; setTimeout(() => t.className = '', 6000); });
// Keyboard support (desktop)
addEventListener('keydown', e => {
  if (e.target && e.target.matches && e.target.matches('input')) { if (e.key === 'Enter' && state.screen === 'newkid') $('[data-createkid]')?.click(); return; }
  if (/^\d$/.test(e.key)) { sound.unlock(); onKey(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { onKey('⌫'); e.preventDefault(); }
  else if (e.key === 'Enter') { if (state.screen === 'play') onKey('✓'); else $('.btn.primary')?.click(); }
  else if (e.key === 'Escape' && state.screen === 'play') $('[data-quit]')?.click();
});
// prevent double-tap zoom / long-press menus on iPad
document.addEventListener('touchend', e => { if (e.target.closest('.key')) e.preventDefault(), e.target.closest('.key').click(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (e.target.closest('.key, .btn')) e.preventDefault(); });

function weeklyRow(k) {
  const now = Date.now(), wk = 7 * 86400e3, cur = periodStats(k, now - wk, now + 1), prev = periodStats(k, now - 2 * wk, now - wk);
  const acc = s => s.n ? Math.round(s.c / s.n * 100) + '%' : '—';
  const delta = (a, b) => b === 0 && a === 0 ? '' : a > b ? `<i class="up">▲ ${a - b}</i>` : a < b ? `<i class="down">▼ ${b - a}</i>` : '<i>=</i>';
  return `<div class="weekly"><b>This week</b>
    <span>${cur.missions} mission${cur.missions === 1 ? '' : 's'} ${delta(cur.missions, prev.missions)}</span>
    <span>${cur.days} day${cur.days === 1 ? '' : 's'} played ${delta(cur.days, prev.days)}</span>
    <span>${acc(cur)} correct${prev.n ? ` <small>(last week ${acc(prev)})</small>` : ''}</span>
    <span>${cur.known} facts newly known ${delta(cur.known, prev.known)}</span>
    <span>${cur.mastered} mastered ${delta(cur.mastered, prev.mastered)}</span>
    <span>⭐ ${cur.stars}</span></div>`;
}
function syncStatusText() {
  const s = sync.status;
  if (!sync.configured()) return 'off';
  if (s.state === 'syncing') return 'syncing…';
  if (s.state === 'error') return '⚠️ ' + (s.error || 'error');
  if (s.state === 'ok' && s.at) { const m = Math.round((Date.now() - s.at) / 60000); return m < 1 ? 'synced just now' : `synced ${m} min ago`; }
  return 'on';
}
// After a merge the kid object may have been replaced — re-point state.kid at the live record.
function refreshKid() { if (state.kid) state.kid = store.kid(state.kid.id) || null; if (!state.kid && state.screen !== 'login' && state.screen !== 'parent') state.screen = 'login'; }
sync.onChange = () => { const h = document.querySelector('#sync-section h3 small'); if (h) h.textContent = syncStatusText(); };
async function pullOnOpen() {
  if (!sync.configured()) return;
  const changed = await sync.pullAndMerge(state.data);
  if (changed) { save(); refreshKid(); if (state.screen !== 'play') render(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullOnOpen(); });
addEventListener('pagehide', () => { if (sync.configured() && sync.timer) { clearTimeout(sync.timer); sync.push(state.data).catch(() => {}); } });

// ---------- boot ----------
screens.pin = screens.pin; // (defined above)
state.pinMode = 'kid';
const last = state.data.currentKid && store.kid(state.data.currentKid);
if (last && !last.pin) { state.kid = last; state.screen = 'home'; }
render();
pullOnOpen();
