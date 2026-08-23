import { OPS, OP_ORDER, allFacts } from './facts.js';
import { store, AVATARS, normalizeKid } from './store.js';
import { Session, MixedSession, opStats, periodStats, troubleFacts, familyStats, placementQuestions, applyPlacement, checkUnlocks, suggestedOp, speedLimit,
         lightningPool, bossPool, levelFor, xpForLevel, MISSION_LENGTH, opData } from './engine.js';
import { sound } from './sound.js';
import { confetti, burst, clearConfetti } from './confetti.js';
import { makeQuestion } from './facts.js';
import { tip, visual } from './teach.js';
import { account, devices, forgetDevice } from './account.js';
import { api } from './api.js';
import { Asteroids } from './asteroids.js';
import { Builder } from './builder.js';
import { Bingo } from './bingo.js';
import { Obby } from './obby.js';
import { bolt, lines, pick } from './companion.js';
import { figure, HATS, FACES, GEAR, SKINS, COLORS, DEFAULT_AVATAR } from './voxel.js';
import { ITEMS, ITEM_ORDER, baseScene, itemPreview, mountBase } from './base.js';
import { planet as planetArt, rocket as rocketArt, asteroid as asteroidArt } from './art.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));



const state = { screen: 'login', kid: null, data: store.load() };
sound.setEnabled(state.data.settings.sound !== false);
sound.musicOnPref = state.data.settings.music !== false;

// ---------- helpers ----------
function save() { store.save(); }
function go(screen, extra = {}) { if (screen !== state.screen) clearConfetti(); Object.assign(state, { screen }, extra); if (screen === 'summary' && extra.summary?.unlocked?.length && !extra.summary._shown) { extra.summary._shown = true; state.unlockOp = extra.summary.unlocked[0]; state.screen = 'unlock'; sound.unlockOp(); confetti({ count: 220 }); } render(); }
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

// ---------- ranks ----------
const RANKS = [[1, 'Cadet', '🎓'], [4, 'Pilot', '🛩️'], [8, 'Captain', '🚀'], [13, 'Commander', '🛰️'], [19, 'Admiral', '🌟'], [26, 'Star Legend', '👑']];
function rankFor(lvl) { let r = RANKS[0]; for (const x of RANKS) if (lvl >= x[0]) r = x; return r; }
function nextRank(lvl) { return RANKS.find(x => x[0] > lvl); }

// ---------- avatars ----------
const randomAvatar = () => ({ ...DEFAULT_AVATAR, skin: SKINS[Math.floor(Math.random() * 5)], shirt: COLORS[Math.floor(Math.random() * 8)], pants: ['#1f2937', '#3b82f6', '#8b5cf6', '#22c55e'][Math.floor(Math.random() * 4)], hatColor: COLORS[Math.floor(Math.random() * 8)] });
function av(k, size = 48, bust = false) { return k && k.avatarCfg ? `<span class="av-fig">${figure(k.avatarCfg, { size, bust })}</span>` : `<span class="avatar" style="font-size:${size * 0.75}px">${esc(k?.avatar || '🦊')}</span>`; }
function ensureAvatar(k) { if (!k.avatarCfg) k.avatarCfg = randomAvatar(); k.avatarCfg.gear ||= 'none'; k.avatarCfg.gearColor ||= '#8b5cf6'; k.owned ||= { hats: ['none'], faces: ['smile'] }; k.owned.gear ||= ['none']; k.base ||= { items: [] }; }
function boltSay(text, mood = 'happy', size = 64) { return `<div class="bolt-row"><span class="bolt-wrap">${bolt(mood, size)}</span><div class="bolt-bubble">${text}</div></div>`; }

// ---------- daily streak / badges ----------
const localDate = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const today = () => localDate(Date.now());
const yesterday = () => localDate(Date.now() - 86400e3);
const ensureKid = normalizeKid;
// Any completed activity keeps the streak alive; only real missions count toward the daily goal.
function touchDaily(k, isMission) {
  ensureKid(k);
  const out = { firstToday: false, goalHit: false };
  if (k.daily.date !== today()) { k.daily = { date: today(), missions: 0, goalPaid: false }; }
  if (k.streak.last !== today()) { k.streak.count = k.streak.last === yesterday() ? k.streak.count + 1 : 1; k.streak.last = today(); k.best.streak = Math.max(k.best.streak || 0, k.streak.count); }
  if (isMission && !k.daily.streakPaid) { k.daily.streakPaid = true; out.firstToday = true; }
  if (isMission) { k.daily.missions++; if (k.daily.missions >= DAILY_GOAL && !k.daily.goalPaid) { k.daily.goalPaid = true; out.goalHit = true; } }
  return out;
}
function dailyBonus(k, t) { let b = 0; if (t.goalHit) b += 50; if (t.firstToday && k.streak.count > 1) b += Math.min(100, k.streak.count * 10); return b; }
const DAILY_GOAL = 2;
const BADGES = [
  { id: 'first', e: '🎖️', n: 'First mission', d: 'Finish your first mission', t: (k) => k.missions >= 1 },
  { id: 'perfect', e: '💯', n: 'Perfect!', d: '20/20 on a mission', t: (k, c) => c.mode === 'mission' && c.n >= MISSION_LENGTH - 4 && c.correct === c.n },
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
  if (state.screen === 'login' || state.screen === 'parent' || state.screen === 'certificate') sound.stopMusic(); else if (state.kid && state.gesture) sound.startMusic();
  sound.duckMusic(state.screen === 'play' || state.screen === 'asteroids');
  sound.setMood(state.screen === 'base' ? 'base' : (state.screen === 'play' && state.play?.mode === 'boss') ? 'tense' : (state.screen === 'play' || state.screen === 'asteroids') ? 'play' : 'calm');
  const fn = screens[state.screen];
  app.innerHTML = fn ? fn() : '<p>?</p>';
  wire();
  app.scrollTop = 0;
}
const screens = {};

// ---------- LOGIN ----------
screens.login = () => {
  if (account.enabled()) return accountLogin();
  const kids = store.kids();
  return `
  <div class="center-col">
    <h1 class="logo"><span>Math</span> Quest</h1>
    <p class="sub">Who's playing today?</p>
    <div class="kid-grid">
      ${kids.map(k => `<button class="kid-card" data-login="${k.id}">${av(k, 64)}<span class="kname">${esc(k.name)}</span><span class="lvl">Lv ${levelFor(k.xp)} · ⭐ ${k.stars}</span></button>`).join('')}
      <button class="kid-card add" data-addkid><span class="avatar">＋</span><span class="kname">New player</span></button>
    </div>
    ${kids.filter(k => OP_ORDER.some(op => opStats(k, op).placed)).length >= 2 ? `<button class="btn accent" data-race>🏁 Sibling Race (2 players)</button>` : ''}
    <button class="link" data-parent>👨‍👩‍👧 Parent zone</button>
    ${installHint()}
  </div>`;
};
const AV = a => a || '🦊';
function accountLogin() {
  const remembered = devices().sort((a, b) => b.at - a.at), kids = remembered.filter(d => d.role === 'kid' && d.refresh_token), parents = remembered.filter(d => d.role === 'parent');
  const allKids = store.kids();
  return `
  <div class="center-col">
    <h1 class="logo"><span>Math</span> Quest</h1>
    <p class="sub">${kids.length ? "Who's playing today?" : 'Welcome! Log in to play.'}</p>
    <p class="err" id="login-err">${esc(state.loginErr || '')}</p>
    <div class="kid-grid">
      ${kids.map(d => { const k = allKids.find(x => x.id === d.user_id); return `<button class="kid-card" data-resume="${d.user_id}">${k ? av(k, 64) : `<span class="avatar">${esc(AV(d.avatar))}</span>`}<span class="kname">${esc(d.name || d.username)}</span><span class="lvl">${k ? `Lv ${levelFor(k.xp)} · ⭐ ${k.stars}` : '@' + esc(d.username || '')}</span></button>`; }).join('')}
      <button class="kid-card add" data-go="kidlogin"><span class="avatar">🔑</span><span class="kname">Kid login</span><span class="lvl">username + password</span></button>
    </div>
    <div class="row wrap" style="justify-content:center">
      <button class="btn small ghost" data-go="parentlogin">👨‍👩‍👧 Parent login${parents[0]?.name ? ` (${esc(parents[0].name)})` : ''}</button>
      ${remembered.length ? '' : '<button class="btn small" data-go="signup">✨ Create a family</button>'}
    </div>
    ${installHint()}
  </div>`;
}
screens.kidlogin = () => `
  <div class="center-col narrow">
    <h2>🔑 Kid login</h2>
    <p class="sub">Ask a parent if you don't know your username or password.</p>
    <label class="field"><span>Username</span><input id="kl-user" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="e.g. max"></label>
    <label class="field"><span>Password</span><input id="kl-pass" type="password" autocomplete="current-password" placeholder="••••"></label>
    <p class="err" id="form-err"></p>
    <div class="row"><button class="btn ghost" data-go="login">Back</button><button class="btn primary" data-kidlogin>Let's go! 🚀</button></div>
  </div>`;
screens.parentlogin = () => `
  <div class="center-col narrow">
    <h2>👨‍👩‍👧 Parent login</h2>
    <label class="field"><span>Email</span><input id="pl-email" type="email" autocomplete="email" autocapitalize="none" placeholder="you@example.com" value="${esc(devices().find(d => d.role === 'parent')?.email || '')}"></label>
    <label class="field"><span>Password</span><input id="pl-pass" type="password" autocomplete="current-password"></label>
    <p class="err" id="form-err"></p>
    <div class="row"><button class="btn ghost" data-go="login">Back</button><button class="btn primary" data-parentlogin>Log in</button></div>
    <button class="link" data-go="signup">New here? Create a family</button>
    <button class="link" data-forgot>Forgot password?</button>
  </div>`;
screens.signup = () => `
  <div class="center-col narrow">
    <h2>✨ Create a family</h2>
    <p class="sub">Parents sign up with an email. Then you add your kids and give each one a username + password.</p>
    <label class="field"><span>Your name</span><input id="su-name" autocomplete="given-name" placeholder="e.g. Dad"></label>
    <label class="field"><span>Email</span><input id="su-email" type="email" autocomplete="email" autocapitalize="none"></label>
    <label class="field"><span>Password (6+ characters)</span><input id="su-pass" type="password" autocomplete="new-password"></label>
    <label class="field"><span>Family name</span><input id="su-family" placeholder="e.g. The Fovals"></label>
    <label class="field"><span>Joining an existing family? Invite code (optional)</span><input id="su-code" autocapitalize="none" placeholder="from the other parent's Parent zone"></label>
    <p class="err" id="form-err"></p>
    <div class="row"><button class="btn ghost" data-go="login">Back</button><button class="btn primary" data-signup>Create account</button></div>
  </div>`;
screens.newpass = () => `
  <div class="center-col narrow">
    <h2>Set a new password</h2>
    <label class="field"><span>New password (6+ characters)</span><input id="np-pass" type="password" autocomplete="new-password"></label>
    <p class="err" id="form-err"></p>
    <button class="btn primary" data-newpass>Save password</button>
  </div>`;
screens.family = () => `
  <div class="center-col narrow">
    <h2>Almost there</h2>
    <p class="sub">Your account exists but isn't in a family yet. Create one, or join with an invite code.</p>
    <label class="field"><span>Your name</span><input id="su-name" placeholder="e.g. Mom"></label>
    <label class="field"><span>Family name</span><input id="su-family" placeholder="e.g. The Fovals"></label>
    <label class="field"><span>Or invite code</span><input id="su-code" autocapitalize="none"></label>
    <p class="err" id="form-err"></p>
    <div class="row"><button class="btn ghost" data-logout>Log out</button><button class="btn primary" data-joinfamily>Continue</button></div>
  </div>`;
screens.addkid = () => `
  <div class="center-col narrow">
    <h2>${state.editKid ? 'Edit player' : 'Add a kid'}</h2>
    <label class="field"><span>Name</span><input id="nk-name" maxlength="16" autocomplete="off" value="${esc(state.editKid?.name || '')}"></label>
    ${(() => { state.draft ||= state.editKid?.avatarCfg ? { ...state.editKid.avatarCfg } : randomAvatar(); return designer(state.draft); })()}
    ${state.editKid ? '' : `<label class="field"><span>Username (they type this to log in)</span><input id="nk-user" autocapitalize="none" autocomplete="off" spellcheck="false" maxlength="20" placeholder="e.g. max"></label>
    <label class="field"><span>Password (6+ characters — a 6-digit PIN is fine)</span><input id="nk-pass" autocomplete="off" placeholder="e.g. 246824"></label>`}
    <p class="err" id="form-err"></p>
    <div class="row"><button class="btn ghost" data-go="parent">Cancel</button><button class="btn primary" data-savekid>${state.editKid ? 'Save' : 'Add kid'}</button></div>
  </div>`;
function designer(cfg) {
  const parts = { skin: 'Skin', shirt: 'Shirt', pants: 'Pants' };
  return `<div class="designer">
    <div class="fig-prev" id="dz-prev">${figure(cfg, { size: 150 })}</div>
    <div class="editor">
      ${Object.entries(parts).map(([part, label]) => `<div class="swatches"><span class="lbl">${label}</span>${(part === 'skin' ? SKINS : COLORS).map(c => `<button type="button" class="sw ${cfg[part] === c ? 'on' : ''}" style="background:${c}" data-dz="${part}:${c}"></button>`).join('')}</div>`).join('')}
      <div class="swatches"><span class="lbl">Face</span>${['smile', 'grin', 'wink', 'sleepy'].map(f => `<button type="button" class="chip ${cfg.face === f ? 'sel' : ''}" data-dz="face:${f}">${FACES[f].name}</button>`).join('')}</div>
      <button type="button" class="btn small ghost" data-dz-shuffle>🎲 Surprise me</button>
      <p class="sub left" style="font-size:.85rem;margin:0">Hats and more faces can be bought with stars in your Star Base.</p>
    </div>
  </div>`;
}
function dzApply(part, value) {
  state.draft ||= randomAvatar(); state.draft[part] = value;
  const prev = $('#dz-prev'); if (prev) prev.innerHTML = figure(state.draft, { size: 150 });
  document.querySelectorAll('[data-dz]').forEach(b => { const [p, v] = b.dataset.dz.split(':'); b.classList.toggle(p === 'face' ? 'sel' : 'on', state.draft[p] === v); });
}
const PARENT_GRACE_MS = 15 * 60e3;
function parentAuthed() { return account.isParent() && (Date.now() - (+sessionStorage.getItem('mq.parentAt') || 0)) < PARENT_GRACE_MS; }
function markParentAuthed() { sessionStorage.setItem('mq.parentAt', String(Date.now())); }
function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.dataset.label ||= btn.textContent; btn.textContent = on ? '…' : btn.dataset.label; }
function formErr(msg) { const e = $('#form-err') || $('#login-err'); if (e) e.textContent = msg; }
async function afterLogin(result, { boot = false } = {}) {
  if (result === 'nofamily') return go('family');
  if (account.isKid()) { const k = await account.loadMyProgress(); ensureAvatar(k); state.kid = k; if (!k.onboarded && !k.missions && !OP_ORDER.some(op => opStats(k, op).placed)) { state.onboardStep = 0; return go('onboard'); } return go('home'); }
  await account.loadFamily(); state.kid = null; return go(boot && !parentAuthed() ? 'login' : 'parent');
}
function installHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || localStorage.getItem('mq.installhint')) return '';
  if (state.installEvent) return `<div class="hint">📲 <b>Install Math Quest as an app</b> — works offline, opens full-screen. <button class="btn small" data-install>Install</button><button class="link" data-dismiss-install>Not now</button></div>`;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return `<div class="hint ios"><b>📲 Put Math Quest on your Home Screen</b><span class="sub left" style="margin:0">The app can't do this itself — it takes 3 taps in Safari:</span>
    <ol><li>Tap Safari's <b>Share</b> button <span class="ios-share">⬆︎</span> (bottom of the screen)</li><li>Scroll down, tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>
    <button class="link" data-dismiss-install>Hide this tip</button></div>`;
  return '';
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installEvent = e; if (state.screen === 'login') render(); });

screens.newkid = () => { state.draft ||= randomAvatar(); return `
  <div class="center-col narrow">
    <h2>Design your character</h2>
    <label class="field"><span>Name</span><input id="nk-name" maxlength="16" autocomplete="off" placeholder="Your name"></label>
    ${designer(state.draft)}
    <label class="field"><span>Secret PIN (optional, 4 digits)</span><input id="nk-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••"></label>
    <div class="row">
      <button class="btn ghost" data-go="login">Cancel</button>
      <button class="btn primary" data-createkid>Let's go! 🚀</button>
    </div>
  </div>`; };

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
  const k = kid(); ensureAvatar(k); const lvl = levelFor(k.xp), nextXp = xpForLevel(lvl + 1), prevXp = xpForLevel(lvl);
  const lvlPct = (k.xp - prevXp) / (nextXp - prevXp);
  const sug = suggestedOp(k);
  ensureKid(k);
  const streakLive = k.streak.last === today() || k.streak.last === yesterday();
  const doneToday = k.daily.date === today() ? k.daily.missions : 0;
  const earned = BADGES.filter(b => k.badges.includes(b.id));
  return `
  <header class="topbar">
    <button class="iconbtn avbtn" data-go="login" title="Switch player">${av(k, 46, true)}</button>
    <div class="who"><b>${esc(k.name)} <span class="rank">${rankFor(lvl)[2]} ${rankFor(lvl)[1]}</span></b><div class="xpbar"><i style="width:${lvlPct * 100}%"></i></div><small>Level ${lvl} · ${k.xp - prevXp}/${nextXp - prevXp} XP${nextRank(lvl) ? ` · ${nextRank(lvl)[1]} at level ${nextRank(lvl)[0]}` : ''}</small></div>
    <div class="stars">⭐ ${k.stars}</div>
    <div class="tb-icons"><button class="iconbtn" data-speak title="Read questions aloud">${k.speak ? '🗣️' : '🤫'}</button>
    <button class="iconbtn" data-music title="Music">${state.data.settings.music === false ? '🎵' : '🎶'}</button>
    <button class="iconbtn" data-sound title="Sound">${state.data.settings.sound ? '🔊' : '🔇'}</button></div>
  </header>
  ${(() => { ensureAvatar(k); const due = OP_ORDER.reduce((a, op) => a + (k.unlocked.includes(op) ? opStats(k, op).due : 0), 0); return boltSay(esc(lines.greet(k, { streak: streakLive ? k.streak.count : 0, due })), streakLive && k.streak.count >= 3 ? 'excited' : 'happy'); })()}
  <section class="daily">
    <div class="chip ${streakLive && k.streak.count ? 'hot' : ''}">${streakLive && k.streak.count ? `🔥 ${k.streak.count}-day streak` : '🔥 Play today to start a streak'}</div>
    ${k.pendingChests ? `<button class="chip goal ready" data-levelchest>🎁 Level-up chest (${k.pendingChests})</button>` : ''}
    <button class="chip goal ${doneToday >= DAILY_GOAL && !k.daily.chestOpened ? 'ready' : ''}" data-chest>${ring(Math.min(1, doneToday / DAILY_GOAL), '#34d399', 34, '')}<span>Today</span>${doneToday >= DAILY_GOAL ? (k.daily.chestOpened ? '✅ Chest opened' : '🎁 Open chest!') : `${doneToday}/${DAILY_GOAL} · chest`}</button>
  </section>
  <section class="planets"><svg class="flightpath" id="flightpath" aria-hidden="true"></svg>
    ${OP_ORDER.map(op => {
      const o = OPS[op], st = opStats(k, op), locked = !k.unlocked.includes(op);
      const label = locked ? 'Locked' : !st.placed ? 'NEW' : fmtPct(st.pct);
      return `<button class="planet ${locked ? 'locked' : ''} ${op === sug ? 'suggested' : ''}" data-planet="${op}" ${locked ? 'disabled' : ''} style="--c:${o.color}">
        <span class="porb">${ring(locked ? 0 : st.pct, o.color, 116, '')}${planetArt(op, 82)}${locked ? '<span class="plock">🔒</span>' : ''}${op === sug && !locked ? `<span class="pship">${rocketArt(40)}</span>` : ''}</span>
        <span class="ppct">${label}</span>
        <span class="pname">${o.planet}</span>
        <span class="psub">${o.name}${!locked && st.due ? ` · ${st.due} to review` : ''}</span>
        ${op === sug && !locked ? '<span class="tag">Go here!</span>' : ''}
      </button>`;
    }).join('')}
  </section>
  <div class="cta"><button class="btn primary huge" data-op="${sug}">${OPS[sug].emoji} Start mission</button><div class="row"><button class="btn base-btn" data-go="base">🏗️ Star Base</button>${k.unlocked.filter(op => opStats(k, op).placed).length >= 2 ? `<button class="btn accent" data-mixed>🌠 Mixed</button>` : ''}</div></div>
  <section class="collection">
    <h3>Records</h3>
    <div class="records">
      <span>⚡ Lightning best <b>${k.best.lightning || 0}</b></span><span>⚔️ Bosses beaten <b>${k.best.bosses || 0}</b></span><span>🔥 Longest streak <b>${k.best.streak || k.streak.count || 0} day${(k.best.streak || k.streak.count || 0) === 1 ? '' : 's'}</b></span><span>🚀 Missions <b>${k.missions}</b></span><span>🧠 Facts mastered <b>${OP_ORDER.reduce((a, op) => a + opStats(k, op).mastered, 0)}</b></span>
    </div>
    <h3>Badges <small>${earned.length}/${BADGES.length}</small></h3>
    <div class="crew">
      ${BADGES.map(b => `<span class="crew-card ${k.badges.includes(b.id) ? '' : 'locked'}" title="${b.d}"><b>${k.badges.includes(b.id) ? b.e : '🔒'}</b><small>${b.n}</small></span>`).join('')}
    </div>
  </section>`;
};

// ---------- DAILY CHEST ----------
const CHEST_LOOT = [
  { w: 40, kind: 'stars', n: 60, label: '+60 ⭐' }, { w: 25, kind: 'stars', n: 120, label: '+120 ⭐' }, { w: 12, kind: 'stars', n: 250, label: '+250 ⭐ Jackpot!' },
  { w: 12, kind: 'hat', label: 'a new hat' }, { w: 8, kind: 'face', label: 'a new face' }, { w: 3, kind: 'gear', label: 'new gear' },
];
function openChest(k) {
  ensureKid(k); ensureAvatar(k);
  let pool = CHEST_LOOT.slice();
  const unowned = { hat: Object.keys(HATS).filter(x => !k.owned.hats.includes(x)), face: Object.keys(FACES).filter(x => !k.owned.faces.includes(x)), gear: Object.keys(GEAR).filter(x => !k.owned.gear.includes(x)) };
  pool = pool.filter(l => l.kind === 'stars' || unowned[l.kind].length);
  let r = Math.random() * pool.reduce((a, l) => a + l.w, 0), loot = pool[0];
  for (const l of pool) { r -= l.w; if (r <= 0) { loot = l; break; } }
  const out = { ...loot };
  if (loot.kind === 'stars') k.stars += loot.n, k.xp += loot.n;
  else { const key = unowned[loot.kind][Math.floor(Math.random() * unowned[loot.kind].length)]; const list = loot.kind === 'hat' ? k.owned.hats : loot.kind === 'face' ? k.owned.faces : k.owned.gear; list.push(key); out.key = key; out.name = (loot.kind === 'hat' ? HATS : loot.kind === 'face' ? FACES : GEAR)[key].name; if (loot.kind === 'hat') k.avatarCfg.hat = key; if (loot.kind === 'face') k.avatarCfg.face = key; if (loot.kind === 'gear') k.avatarCfg.gear = key; }
  save();
  return out;
}
screens.chest = () => {
  const k = kid(), l = state.loot;
  return `
  <div class="center-col narrow summary">
    <h2>${l ? (state.title || 'Chest') : "Today's chest"}</h2>
    ${l ? `<div class="chest open">🎁</div>
      ${boltSay(l.kind === 'stars' ? esc(pick(['Ooh, shiny!', 'Cha-ching!', 'Stars for the base fund!'])) : esc(`A ${l.name}! I put it on for you.`), 'excited', 60)}
      <div class="bigstars">${l.kind === 'stars' ? l.label : `🎉 ${esc(l.name)}`}</div>
      ${l.kind !== 'stars' ? `<div class="fig-prev">${figure(k.avatarCfg, { size: 160 })}</div>` : ''}
      <div class="col"><button class="btn primary huge" data-go="home">Back to base</button>${l.kind !== 'stars' ? '<button class="btn ghost" data-go="base">Open the avatar editor</button>' : ''}</div>`
    : `<div class="chest">🎁</div>
      ${boltSay('Finish today\'s goal and this opens. Could be stars, could be a hat…', 'think', 60)}
      <div class="col"><button class="btn primary huge" data-op="${suggestedOp(k)}">${OPS[suggestedOp(k)].emoji} Start a mission</button><button class="btn ghost" data-go="home">Back</button></div>`}
  </div>`;
};

// ---------- STAR BASE & AVATAR ----------
screens.base = () => {
  const k = kid(); ensureAvatar(k); const tab = state.baseTab || 'base';
  const owned = new Set(k.base.items);
  return `
  <header class="topbar"><button class="iconbtn" data-go="home">←</button><div class="who"><b>🏗️ Star Base</b><small>Spend stars to build it up</small></div><div class="stars">⭐ ${k.stars}</div></header>
  <div class="tabs"><button class="tab ${tab === 'base' ? 'on' : ''}" data-basetab="base">Base</button><button class="tab ${tab === 'avatar' ? 'on' : ''}" data-basetab="avatar">Avatar</button></div>
  ${tab === 'base' ? `
    <div class="scene-wrap"><div class="scene" id="base-scene"></div><div class="scene-hint">Drag to look around · pinch or scroll to zoom · drag items to move them <button class="link" data-base-reset>Reset layout</button></div></div>
    ${k.base.items.length ? '' : boltSay('Your base is empty! Buy a flag to claim it.', 'think', 56)}
    <div class="bshop">${ITEM_ORDER.map(key => { const it = ITEMS[key], has = owned.has(key), can = k.stars >= it.price; return `<div class="item ${has ? 'owned' : ''}"><div class="prev">${itemPreview(key, k)}</div><b>${it.name}</b><small>${it.blurb}</small>${has ? '<span class="tagown">Built ✓</span>' : `<button class="btn small ${can ? '' : 'ghost'}" data-buy="${key}">⭐ ${it.price}</button>`}</div>`; }).join('')}</div>`
  : `
    <div class="avatar-editor">
      <div class="fig-prev">${figure(k.avatarCfg, { size: 200 })}</div>
      <div class="editor">
        ${['skin', 'shirt', 'pants', 'hatColor', 'gearColor'].map(part => `<div class="swatches"><span class="lbl">${{ skin: 'Skin', shirt: 'Shirt', pants: 'Pants', hatColor: 'Hat color', gearColor: 'Gear color' }[part]}</span>${(part === 'skin' ? SKINS : COLORS).map(c => `<button class="sw ${k.avatarCfg[part] === c ? 'on' : ''}" style="background:${c}" data-avcolor="${part}:${c}"></button>`).join('')}</div>`).join('')}
        <div class="swatches"><span class="lbl">Hats</span>${Object.entries(HATS).map(([key, h]) => { const has = k.owned.hats.includes(key), eq = k.avatarCfg.hat === key; return `<button class="chip ${eq ? 'sel' : ''}" data-hat="${key}">${h.name}${has ? '' : ` · ⭐${h.price}`}</button>`; }).join('')}</div>
        <div class="swatches"><span class="lbl">Gear</span>${Object.entries(GEAR).map(([key, g]) => { const has = k.owned.gear.includes(key), eq = k.avatarCfg.gear === key; return `<button class="chip ${eq ? 'sel' : ''}" data-gear="${key}">${g.name}${has ? '' : ` · ⭐${g.price}`}</button>`; }).join('')}</div>
        <div class="swatches"><span class="lbl">Faces</span>${Object.entries(FACES).map(([key, f]) => { const has = k.owned.faces.includes(key), eq = k.avatarCfg.face === key; return `<button class="chip ${eq ? 'sel' : ''}" data-face="${key}">${f.name}${has ? '' : ` · ⭐${f.price}`}</button>`; }).join('')}</div>
      </div>
    </div>`}
  <p class="err" id="form-err"></p>`;
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
      ${st.placed ? `<div class="gameroom">${Object.entries(GAMES).filter(([, g]) => g.ops.includes(op)).map(([key, g]) => `<button class="gcard" data-game="${key}:${op}"><b>${g.icon}</b><span>${g.name}</span><small>${g.blurb}</small></button>`).join('')}</div><div class="row">
        <button class="btn accent" data-lightning="${op}">⚡ Lightning</button>
        <button class="btn ${bossReady ? 'boss' : 'ghost'}" data-boss="${op}" ${bossReady ? '' : 'disabled'}>⚔️ Boss${bossReady ? '' : ` 🔒 ${2 - (k.opMissions[op] || 0)} more`}</button>
      </div>` : ''}
    </div>
    ${st.placed && troubleFacts(k, op).length ? `<div class="trouble"><h3>🎯 Facts to watch</h3>
      <div class="tf-list">${troubleFacts(k, op).map(t => `<span class="tf"><b>${t.fact.a} ${o.sym} ${t.fact.b}</b><small>${t.misses ? `${t.misses} miss${t.misses === 1 ? '' : 'es'}` : 'slow'}</small></span>`).join('')}</div>
      <button class="btn accent" data-trouble="${op}">🎯 Drill these</button></div>` : ''}
    ${st.placed ? `<h3>Practice a set</h3>
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
        : `<div class="track"><div class="trail">${Array.from({ length: total }, (_, i) => `<i class="${p.dots[i] || ''} ${i === p.index ? 'cur' : ''}" style="left:${(i + 0.5) / total * 100}%">${p.dots[i] === 'bad' ? asteroidArt(14) : ''}</i>`).join('')}</div>
             <div class="ship" style="left:${Math.min(100, (p.index + 0.5) / total * 100)}%">${rocketArt(48, 0.6 + Math.min(p.combo, 10) * 0.12)}</div>
             <div class="dest">${planetArt(o.key, 34)}</div></div>
           <small>${p.mode === 'placement' ? '🔭 Scanning ' + o.planet : p.op === 'mix' ? '🌠 Mixed mission · ' + o.name : o.emoji + ' Mission on ' + o.planet + (p.family != null ? ` · the ${o.sym}${p.family}s` : '')}</small>`}
    </div>
    <div class="stars" id="play-stars">⭐ ${p.stars}</div>
  </header>
  <div class="combo" id="combo"></div>
  <div class="qwrap ${teach ? 'teach' : ''} ${p.mode === 'boss' ? 'bossmode' : ''}" id="qwrap">
    ${p.mode === 'boss' ? `<div class="boss-stage"><span class="bossface big" id="boss-big">${p.boss.e}</span><div class="boss-name">${p.boss.n}</div></div>` : ''}
    ${teach ? boltSay(esc(pick(lines.teach)), 'excited', 52) : ''}
    <div class="question" id="question">${p.q.a} <span class="sym" style="color:${o.color}">${p.q.sym}</span> ${p.q.b} =${teach ? ` <span class="shown">${p.q.ans}</span>` : ''}</div>
    ${teach ? visual(p.q.fact) : ''}
    ${t ? `<div class="tip">💡 ${t}</div>` : ''}
    <div class="answer" id="answer"><span class="caret">&nbsp;</span></div>
    ${teach || p.mode === 'lightning' ? '' : `<div class="fuel" title="Answer before the fuel runs out for a speed bonus"><i id="fuel" style="animation-duration:${speedLimit(p.q.fact.op, kid())}ms"></i></div>`}
    <div class="feedback" id="feedback">${teach ? 'Type the answer to remember it' : ''}</div>
  </div>
  ${numpad(true)}`;
};

function startPlacement(op) {
  const qs = placementQuestions(op);
  state.play = { mode: 'placement', op, qs, dots: [], index: 0, total: qs.length, results: [], stars: 0, combo: 0, input: '', q: qs[0], t0: 0, busy: false };
  go('intro', { intro: { op, mood: 'think', title: `🔭 Scanning ${OPS[op].planet}`, body: `Quick check! Answer ${qs.length} ${OPS[op].name.toLowerCase()} questions as fast as you can. Don't worry about wrong ones — it just tells the ship what to teach you.`, btn: 'Start scan', then: () => { go('play'); startQ(); } } });
}
function startMission(op, family = null, filterIds = null) {
  const k = kid();
  const ops = op === 'mix' ? k.unlocked.filter(o => opStats(k, o).placed) : null;
  const sess = ops ? new MixedSession(k, ops) : new Session(k, op, family, filterIds ? (f => filterIds.has(f.id)) : null);
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
  go('intro', { intro: { back: 'login', icon: '🏁', title: `${esc(r.kid.name)}'s turn!`, body: `${p.perTurn} questions on ${OPS[r.op].planet}. Fast and right = more points. Hand over the device!`, btn: p.round === 0 && p.turn === 0 ? '🏁 Go!' : 'Ready!', then: () => { go('play'); startQ(); } } });
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
  for (const r of p.racers) { ensureKid(r.kid); r.kid.stars += r.stars; r.kid.xp += r.stars; touchDaily(r.kid, false); r.kid.history.push({ t: Date.now(), kind: 'race', op: r.op, n: r.n, c: r.correct, stars: r.stars, secs: Math.round(playSecs(p) / p.racers.length) }); }
  if (!tie) { sorted[0].kid.stars += 50; sorted[0].kid.xp += 50; }
  for (const r of p.racers) checkUnlocks(r.kid);
  save(); sound.fanfare(); confetti({ count: 180 });
  state.kid = null; const racePlay = p; state.play = null;
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
  go('intro', { intro: { icon: e, mood: 'think', title: `${n} appears!`, body: `Every correct answer hits the boss. Fast answers are critical hits (double damage)! Wrong answers cost you a heart — lose all 3 and the boss escapes. Take down ${hp} HP to win!`, btn: '⚔️ Fight!', then: () => { go('play'); startQ(); } } });
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

const GAMES = {
  asteroids: { cls: Asteroids, name: 'Asteroid Blaster', icon: '☄️', ops: ['add', 'sub', 'mul', 'div'], blurb: 'Blast the asteroid with the right answer', intro: { title: '☄️ Asteroid field ahead!', body: 'Numbered asteroids are coming at your ship. Blast the one that answers the question on your hull — tap it, or press its number key. Wrong rocks and rocks that reach you cost a shield. Survive 12!', btn: '☄️ Blast off' },
    title: r => r.survived ? '☄️ Field cleared!' : '💥 Shields down!', bonus: r => r.survived ? 40 : 0, line: (r, c) => `<b>${c}/${r.results.length}</b> asteroids blasted · best combo <b>${r.maxCombo}</b>${r.survived ? ' · survival bonus <b>+40 ⭐</b>' : ''}`, again: 'Blast again' },
  smoothie: { cls: Builder, name: 'Smoothie Shop', icon: '🥤', ops: ['add', 'sub'], blurb: 'Count the fruit into the blender — see the answer', intro: { title: '🥤 Smoothie Shop', body: 'Customers order fruit smoothies with a math problem. Fill the ten-frames with exactly the right number of fruits, then blend! No timer — take your time and count.', btn: '🥤 Open the shop' },
    title: r => '🥤 Shop closed for today!', bonus: () => 0, line: (r, c) => `<b>${c}/${r.results.length}</b> happy customers`, again: 'Open the shop again' },
  farm: { cls: Builder, name: 'Array Farm', icon: '🌱', ops: ['mul', 'div'], blurb: 'Plant rows of seeds — see why the answer is what it is', intro: { title: '🌱 Array Farm', body: 'Drag across the field to plant rows of seeds. The skip-counts show up as rows fill, so you can see the answer grow. Then type the total and harvest. No timer.', btn: '🌱 Start planting' },
    title: r => '🌾 Harvest done!', bonus: () => 0, line: (r, c) => `<b>${c}/${r.results.length}</b> fields harvested`, again: 'Plant again' },
  obby: { cls: Obby, name: 'Math Obby', icon: '🏃', ops: ['add', 'sub', 'mul', 'div'], blurb: 'Jump platform to platform over the lava', intro: { title: '🏃 Math Obby', body: 'Your character has to cross the lava. Each jump, three platforms appear with answers — tap the right one (or press 1–3) to land safely. Wrong platforms crumble! Clear 10 jumps with no falls for a bonus.', btn: '🏃 Start the obby' },
    title: r => r.falls === 0 ? '🏁 Flawless run!' : '🏁 Made it across!', bonus: () => 0, line: (r, c) => `<b>${c}/${r.results.length}</b> jumps landed · ${r.falls} fall${r.falls === 1 ? '' : 's'}${r.falls === 0 ? ' · no-fall bonus <b>+60 ⭐</b>' : ''}`, again: 'Run it again' },
  bingo: { cls: Bingo, name: 'Bingo Bugs', icon: '🐞', ops: ['add', 'sub', 'mul', 'div'], blurb: 'Find the answer on your card — five in a row!', intro: { title: '🐞 Bingo Bugs', body: 'Solve the problem and tap its answer on your bingo card. A bug lands on every right answer. Get two lines of five to win!', btn: '🐞 Deal the card' },
    title: r => r.won ? '🐞 BINGO!' : '🐞 Card finished', bonus: () => 0, line: (r, c) => `<b>${c}/${r.results.length}</b> correct · ${r.lines} line${r.lines === 1 ? '' : 's'}`, again: 'New card' },
};
screens.asteroids = () => '';  // rendered by the game itself
function startGame(kindKey, op) {
  const g = GAMES[kindKey]; state.gameStart = Date.now(); state.play = null;
  go('intro', { intro: { ...g.intro, icon: g.icon, then: () => {
    clearConfetti(); sound.duckMusic(true); state.play = null; state.screen = 'asteroids'; app.className = 'screen-asteroids screen-game-' + kindKey; app.innerHTML = '';
    state.game = new g.cls({ kid: kid(), op, root: app, speak: q => speak(speakText(q)), onEnd: r => finishGame(kindKey, r) });
  } } });
}
function finishGame(kindKey, r) {
  const g = GAMES[kindKey], k = kid();
  const p = { op: r.op, results: r.results, stars: r.stars + g.bonus(r), maxCombo: r.maxCombo, startedAt: state.gameStart };
  state.game = null;
  const td = touchDaily(k, true); const bonus = dailyBonus(k, td); p.stars += bonus;
  k.stars += p.stars; k.xp += p.stars; k.opMissions[r.op] = (k.opMissions[r.op] || 0) + 1;
  const correct = r.results.filter(x => x.correct).length;
  logActivity(k, kindKey, p, correct);
  const unlocked = checkUnlocks(k);
  const badges = checkBadges(k, { mode: kindKey, correct, n: r.results.length, maxCombo: r.maxCombo, fastest: Math.min(...r.results.filter(x => x.correct).map(x => x.ms)) });
  const lvB = levelFor(k.xp - p.stars), lvA = levelFor(k.xp); if (lvA > lvB) { k.pendingChests = (k.pendingChests || 0) + (lvA - lvB); setTimeout(() => sound.levelUp(), 300); }
  save(); if (r.survived || r.won) { sound.fanfare(); confetti({ count: 160 }); }
  go('summary', { summary: { title: g.title(r), op: r.op, lines: [g.line(r, correct)].concat(lvA > lvB ? [`🎉 <b>Level ${lvA}!</b> A bonus chest is waiting.`] : []).concat(bonus ? [`🎁 Bonus <b>+${bonus} ⭐</b> ${td.goalHit ? 'for finishing today\'s goal' : `for your ${k.streak.count}-day streak`}!`] : []), stars: p.stars, unlocked, badges, nextBtn: g.again, nextOp: r.op, game: kindKey, lightning: false } });
}

const ONBOARD = [
  { mood: 'excited', text: (k) => `Hi ${esc(k.name)}! I'm Bolt, your ship's robot. Welcome aboard!`, art: () => `<span style="display:inline-block;transform:rotate(-45deg)">${rocketArt(130, 1.4)}</span>` },
  { mood: 'happy', text: () => `There are four planets out there. Each one is a kind of math. We'll explore them one fact at a time.`, art: () => `<div class="row" style="gap:6px;justify-content:center">${OP_ORDER.map(op => planetArt(op, 64)).join('')}</div>` },
  { mood: 'excited', text: () => `Every answer earns stars. Spend stars on your Star Base and on gear for your character!`, art: (k) => figure(k.avatarCfg, { size: 130 }) },
  { mood: 'think', text: () => `First, a quick scan so I know what you already know. No pressure — wrong answers just tell me what to teach. Ready?`, art: () => planetArt('add', 120) },
];
screens.onboard = () => {
  const k = kid(), i = state.onboardStep || 0, step = ONBOARD[i];
  return `
  <div class="center-col narrow intro">
    <div class="intro-art">${step.art(k)}</div>
    ${boltSay(step.text(k), step.mood, 64)}
    <div class="dots small">${ONBOARD.map((_, j) => `<i class="${j <= i ? 'ok' : ''}"></i>`).join('')}</div>
    <div class="col">
      <button class="btn primary huge" data-onboard-next>${i < ONBOARD.length - 1 ? 'Next' : "Let's go! 🚀"}</button>
      ${i < ONBOARD.length - 1 ? '<button class="link" data-onboard-skip>Skip</button>' : ''}
    </div>
  </div>`;
};
screens.intro = () => `
  <div class="center-col narrow intro">
    <div class="intro-art">${state.intro.op ? planetArt(state.intro.op, 140) : `<span class="intro-icon">${state.intro.icon || '🚀'}</span>`}</div>
    <h2>${state.intro.title.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '')}</h2>
    ${boltSay(state.intro.body, state.intro.mood || 'excited', 60)}
    <button class="btn primary huge" data-intro-go>${state.intro.btn}</button>
    <button class="link" data-go="${state.intro.back || 'home'}">← Back to base</button>
  </div>`;

function startQ() {
  const p = state.play; p.startedAt ||= Date.now(); p.t0 = performance.now(); p.input = ''; p.busy = false;
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
    if (p.input === target) { if (p.q.teach) p.dots.push('teach'); p.fixing = false; p.busy = true; ans.classList.remove('bad'); ans.classList.add('good'); sound.correct(0); setTimeout(() => { if (state.play === p && state.screen === 'play') nextQ(); }, 350); }
    else { p.input = ''; $('#qwrap').classList.remove('wrong'); void $('#qwrap').offsetWidth; $('#qwrap').classList.add('wrong'); sound.wrong(); setTimeout(() => { if (ans && p.fixing) ans.innerHTML = '<span class="caret">&nbsp;</span>'; }, 250); }
  }
}

function floatGain(text, fromEl) {
  const r = (fromEl || $('#answer')).getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'float-gain'; el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 900);
}
function countUp(el, to) {
  if (!el) return; const from = parseInt(el.dataset.v || el.textContent.replace(/\D/g, ''), 10) || 0; el.dataset.v = to;
  const t0 = performance.now(), dur = 400;
  const step = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); el.textContent = `⭐ ${v}`; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
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
    qw.classList.add('right'); ans.classList.add('good'); ans.classList.add('pop');
    const r = ans.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2);
    floatGain(`+${gained} ⭐`); $('#fuel')?.classList.add('stop');
    fb.innerHTML = `<span class="pop">${fast ? '⚡ Speedy!' : ['Nice!', 'Yes!', 'Got it!', 'Boom!', 'Correct!'][Math.floor(Math.random() * 5)]}</span> <span class="gain">+${gained} ⭐</span>`;
    if (p.mode === 'boss') {
      const dmg = fast ? 2 : 1; p.bossHp = Math.max(0, p.bossHp - dmg);
      fb.innerHTML = `<span class="pop">${fast ? '💥 CRITICAL HIT! −2' : '🗡️ Hit! −1'}</span> <span class="gain">+${gained} ⭐</span>`;
      $('#boss-hp').style.width = (p.bossHp / p.boss.hp * 100) + '%'; $('#boss-num').textContent = p.bossHp;
      document.querySelectorAll('.bossface').forEach(el => { el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt'); }); floatGain(fast ? '−2' : '−1', $('#boss-big'));
    }
  } else {
    if (p.mode === 'boss') { p.hearts--; $('#hearts').textContent = '❤️'.repeat(p.hearts) + '🖤'.repeat(3 - p.hearts); const bb = $('#boss-big'); if (bb) { bb.classList.remove('attack'); void bb.offsetWidth; bb.classList.add('attack'); } }
    p.combo = 0;
    if (p.mode === 'mission' || p.mode === 'boss' || p.mode === 'race') p.sess.answer(p.q, false, ms, 0);
    sound.wrong();
    qw.classList.add('wrong'); ans.classList.add('bad'); $('#fuel')?.classList.add('stop');
    fb.innerHTML = `<span class="pop">Not quite — <b>${p.q.text} = ${p.q.ans}</b></span>`;
    if (p.mode === 'mission' || p.mode === 'boss') {
      // show the answer, then hand control back so they type it
      setTimeout(() => { if (state.screen !== 'play' || state.play !== p) return; p.input = ''; p.busy = false; p.fixing = true; ans.classList.remove('bad'); qw.classList.remove('wrong'); $('#fuel')?.parentElement?.remove(); ans.innerHTML = '<span class="caret">&nbsp;</span>'; fb.innerHTML = `<span class="pop">Type it: <b>${p.q.text} = ${p.q.ans}</b></span><br><small class="boltline">🤖 ${esc(pick(lines.miss))}</small>`; speak(`${speakText(p.q)} equals ${p.q.ans}`); }, 1100);
      countUp($('#play-stars'), p.stars); const c = $('#combo'); c.textContent = ''; c.className = 'combo';
      if (p.mode === 'boss' && p.hearts <= 0) return setTimeout(() => { if (state.play === p && state.screen === 'play') finishBoss(false); }, 1700);
      return;
    }
  }
  countUp($('#play-stars'), p.stars);
  const combo = $('#combo');
  combo.textContent = p.combo >= 3 ? `🔥 ${p.combo} combo!` : '';
  combo.className = 'combo' + (p.combo >= 3 ? ' show' : '');
  if (p.mode === 'race') raceAfterAnswer(correct, ms);
  const live = () => state.play === p && state.screen === 'play';
  if (p.mode === 'boss' && (p.bossHp <= 0 || p.hearts <= 0)) return setTimeout(() => { if (live()) finishBoss(p.bossHp <= 0); }, correct ? 700 : 1700);
  setTimeout(() => { if (live()) nextQ(); }, correct ? (p.mode === 'lightning' ? 300 : 450) : 1700);
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
  k.stars += p.stars; k.xp += p.stars; touchDaily(k, false);
  const correct = p.results.filter(r => r.correct).length; logActivity(k, 'scan', p, correct);
  const unlocked = checkUnlocks(k); save();
  const st = opStats(k, p.op);
  go('summary', { summary: { title: '🔭 Scan complete!', op: p.op, lines: [
    `You got <b>${correct}/${p.results.length}</b> right.`,
    `${OPS[p.op].planet} is <b>${fmtPct(st.known / st.total)}</b> explored already.`,
    st.known / st.total >= 0.85 ? `You already know ${OPS[p.op].name.toLowerCase()}! We'll keep checking now and then.` : `Your ship will teach you the rest, a few facts at a time.`,
  ], stars: p.stars, unlocked, nextBtn: st.known / st.total >= 0.85 && unlocked.length ? `Fly to ${OPS[unlocked[0]].planet}` : `Start first mission`, nextOp: unlocked[0] || p.op, lightning: false } });
}

function finishMission() {
  const p = state.play, k = kid();
  ensureKid(k); const td = touchDaily(k, true); if (p.op !== 'mix') k.opMissions[p.op] = (k.opMissions[p.op] || 0) + 1;
  const bonus = dailyBonus(k, td);
  p.stars += bonus;
  k.stars += p.stars; k.xp += p.stars; k.missions++;
  const correct = p.results.filter(r => r.correct).length;
  const before = levelFor(k.xp - p.stars), after = levelFor(k.xp);
  k.history.push({ t: Date.now(), kind: 'mission', op: p.op, n: p.results.length, c: correct, stars: p.stars, secs: playSecs(p) });
  if (k.history.length > 400) k.history.shift();
  const unlocked = checkUnlocks(k); save();
  const st = p.op === 'mix' ? null : opStats(k, p.op), bst = p.beforeStats;
  const fastest = Math.min(...p.results.filter(r => r.correct).map(r => r.ms));
  const sumLines = [
    `<b>${correct}/${p.results.length}</b> correct · best combo <b>${p.maxCombo}</b>${isFinite(fastest) ? ` · fastest <b>${(fastest / 1000).toFixed(1)}s</b>` : ''}`,
    bst ? `${OPS[p.op].planet}: <b>${fmtPct(bst.pct)} → ${fmtPct(st.pct)}</b> explored` + (p.newFacts ? ` · ${p.newFacts} new fact${p.newFacts > 1 ? 's' : ''} learned` : '') : `🌠 Mixed mission across ${p.sess.ops.length} planets` + (p.newFacts ? ` · ${p.newFacts} new fact${p.newFacts > 1 ? 's' : ''} learned` : ''),
  ];
  if (after > before) { setTimeout(() => sound.levelUp(), 300); k.pendingChests = (k.pendingChests || 0) + (after - before); sumLines.push(`🎉 <b>Level ${after}!</b> ${rankFor(after)[1] !== rankFor(before)[1] ? `You're now a <b>${rankFor(after)[2]} ${rankFor(after)[1]}</b>! ` : ''}A bonus chest is waiting.`); }
  if (bonus) sumLines.push(`🎁 Bonus <b>+${bonus} ⭐</b> ${td.goalHit ? 'for finishing today\'s goal' : `for your ${k.streak.count}-day streak`}!`);
  const fastCount = p.results.filter(r => r.correct && r.ms <= speedLimit(r.fact.op, k)).length, acc = correct / p.results.length;
  const rating = acc >= 0.95 && fastCount / p.results.length >= 0.6 ? 3 : acc >= 0.8 ? 2 : 1;
  const badges = checkBadges(k, { mode: 'mission', correct, n: p.results.length, maxCombo: p.maxCombo, fastest });
  save();
  go('summary', { summary: { title: '🏁 Mission complete!', op: p.op, lines: sumLines, stars: p.stars, unlocked, badges, levelUp: after > before, nextBtn: p.op === 'mix' ? 'Another mixed mission' : 'Another mission', nextOp: p.op, family: p.family, lightning: p.op !== 'mix', rating } });
}

function finishLightning() {
  const p = state.play, k = kid();
  if (state.screen !== 'play') return;
  k.stars += p.stars; k.xp += p.stars;
  const correct = p.results.filter(r => r.correct).length;
  const record = correct > (k.best.lightning || 0);
  if (record) k.best.lightning = correct;
  touchDaily(k, false); logActivity(k, 'lightning', p, correct);
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
  const correct = p.results.filter(r => r.correct).length; logActivity(k, 'boss', p, correct);
  const unlocked = checkUnlocks(k);
  const badges = checkBadges(k, { mode: 'boss', maxCombo: p.maxCombo, fastest: Math.min(...p.results.filter(r => r.correct).map(r => r.ms)) });
  save();
  const nextBoss = BOSSES[Math.min(BOSSES.length - 1, k.best.bosses || 0)];
  go('summary', { summary: { title: won ? `🏆 ${p.boss.n} defeated!` : `💨 ${p.boss.n} escaped…`, op: p.op, lines: [
    won ? `Victory bonus <b>+100 ⭐</b> · ${correct} hits landed` : `You landed <b>${correct}</b> hits. Train a bit more and try again!`,
    won ? `Next challenger: ${nextBoss[0]} <b>${nextBoss[1]}</b> (${nextBoss[2]} HP)` : `Best combo <b>${p.maxCombo}</b>`,
  ], stars: p.stars, unlocked, badges, levelUp: won, nextBtn: won ? 'Another mission' : 'Train with a mission', nextOp: p.op, lightning: false, boss: p.op } });
}

screens.unlock = () => {
  const op = state.unlockOp, o = OPS[op];
  return `
  <div class="center-col narrow intro">
    <div class="intro-art unlock-art" style="--c:${o.color}">${planetArt(op, 170)}</div>
    <h2>New planet: ${o.planet}</h2>
    ${boltSay(esc(pick(lines.unlock)) + ` ${o.name} is waiting.`, 'excited', 64)}
    <div class="col">
      <button class="btn primary huge" data-op="${op}">${o.emoji} Fly there now</button>
      <button class="btn ghost" data-unlock-done>Later</button>
    </div>
  </div>`;
};
screens.summary = () => {
  const s = state.summary;
  return `
  <div class="center-col narrow summary">
    <h2>${s.title}</h2>
    ${s.rating ? boltSay(esc(pick(lines.summary[s.rating])), s.rating === 3 ? 'excited' : s.rating === 2 ? 'happy' : 'think', 56) : boltSay(esc(s.bolt || pick(s.stars > 0 ? lines.summary[2] : lines.summary[1])), s.stars > 0 ? 'happy' : 'think', 56)}
    ${s.rating ? `<div class="rating">${[1, 2, 3].map(i => `<span class="${i <= s.rating ? 'on' : ''}" style="animation-delay:${i * .18}s">★</span>`).join('')}</div><p class="sub" style="margin:0">${['', 'Keep training!', 'Great flying!', 'Perfect flight!'][s.rating]}</p>` : ''}
    <div class="bigstars">+${s.stars} ⭐</div>
    ${s.lines.map(l => `<p class="line">${l}</p>`).join('')}
    ${s.unlocked.map(op => `<div class="unlock" style="--c:${OPS[op].color}">${OPS[op].emoji} <b>${OPS[op].planet} unlocked!</b><br><small>${OPS[op].name} is ready to explore</small></div>`).join('')}
    ${(s.badges || []).map(b => `<div class="unlock badge" style="--c:#fde047">${b.e} <b>New badge: ${b.n}</b><br><small>${b.d}</small></div>`).join('')}
    <div class="col">
      ${kid()?.pendingChests ? `<button class="btn accent huge" data-levelchest>🎁 Open your level-up chest</button>` : ''}
      <button class="btn primary huge" ${s.game ? `data-game="${s.game}:${s.op}"` : s.nextOp === 'race' ? `data-race-go="${s.raceIds.join(',')}"` : s.nextOp === 'mix' ? 'data-mixed' : s.family != null ? `data-family="${s.op}:${s.family}"` : `data-op="${s.nextOp}"`}>${s.nextOp === 'race' ? '🏁' : s.nextOp === 'mix' ? '🌠' : OPS[s.nextOp].emoji} ${s.nextBtn}${s.family != null ? ` (${OPS[s.op].sym}${s.family}s)` : ''}</button>
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
  if (account.enabled() && !parentAuthed()) return screens.parentlogin();
  const kids = store.kids();
  const acct = account.enabled();
  return `
  <header class="topbar"><button class="iconbtn" data-go="login">←</button><div class="who"><b>Parent zone</b>${acct ? `<small>${esc(account.family?.name || '')} · ${esc(account.me?.name || '')} · ${syncText()}</small>` : ''}</div>${acct ? '<button class="btn small ghost" data-logout>Log out</button>' : ''}</div></header>
  <div class="parent">
    ${acct ? `<section class="pkid"><h3>👨‍👩‍👧 Family</h3>
      <div class="controls"><button class="btn small" data-addkid>＋ Add a kid</button>
        <span class="muted">Invite code for another parent: <b style="color:#fff;letter-spacing:.1em">${esc(account.family?.invite_code || '')}</b></span></div>
      <p class="sub left" style="font-size:.9rem">Parents: ${account.members.filter(m => m.role === 'parent').map(m => esc(m.name)).join(', ') || '—'}. Kids log in on any device with their username + password.</p>
    </section>` : ''}
    <details class="pop-row"><summary>How the learning works <span class="pstat">tap to read</span></summary><p class="sub left" style="font-size:.92rem">Each kid gets a quick scan per operation. Missions then drill the facts they don't know, a few at a time, using spaced repetition: a fact counts as mastered only after being answered quickly and correctly on several separate days, and mastered facts are re-checked every few weeks. The next operation unlocks at 85% known.</p></details>
    ${kids.length ? '' : '<p class="sub">No players yet.</p>'}
    ${kids.map(k => {
      const recent = k.history.slice(-7), rc = recent.reduce((a, h) => a + h.c, 0), rn = recent.reduce((a, h) => a + h.n, 0);
      return `<section class="pkid" data-kid="${k.id}">
        <h3>${av(k, 40, true)} ${esc(k.name)} <small>Level ${levelFor(k.xp)} · ⭐ ${k.stars} · ${k.missions} missions${rn ? ` · last 7 missions ${Math.round(rc / rn * 100)}% correct` : ''}</small></h3>
        <div class="week">${Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 86400e3); const ds = localDate(d); const hs = k.history.filter(h => localDate(h.t) === ds), n = hs.length, mins = Math.round(hs.reduce((a, h) => a + (h.secs || 0), 0) / 60); return `<span class="day ${n ? 'on' : ''}" title="${n} activities, ${mins} min"><b>${n ? mins + 'm' : ''}</b><small>${['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</small></span>`; }).join('')}<small class="sub left" style="margin:0 0 0 8px">minutes per day · 🔥 ${(k.streak || {}).count || 0}-day streak · ⚔️ ${(k.best || {}).bosses || 0} bosses</small></div>
        ${weeklyRow(k)}
        ${(() => { const all = OP_ORDER.filter(op => k.unlocked.includes(op)).flatMap(op => troubleFacts(k, op, 4).map(t => ({ ...t, op }))).sort((a, b) => b.score - a.score).slice(0, 6); return all.length ? `<div class="controls"><span class="lbl">Practice at home:</span>${all.map(t => `<span class="tf small"><b>${t.fact.a} ${OPS[t.op].sym} ${t.fact.b} = ${t.fact.ans}</b></span>`).join('')}</div>` : ''; })()}
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
        <div class="controls"><span class="lbl">Speed for "fast":</span>
          ${['relaxed', 'normal', 'fast'].map(sp => `<button class="btn small ${(k.speed || 'normal') === sp ? '' : 'ghost'}" data-speed="${k.id}:${sp}">${sp}</button>`).join('')}
          <span class="muted">relaxed 6s/10s · normal 4s/6s · fast 3s/4s (+− / ×÷)</span></div>
        <div class="controls"><span class="lbl">Account${acct ? ` · @${esc(k.username || '')}` : ''}:</span>
          ${acct ? `<button class="btn small ghost" data-editkid="${k.id}">Edit name / avatar</button><button class="btn small ghost" data-kidpass="${k.id}">Reset password</button>` : `<button class="btn small ghost" data-setpin="${k.id}">Change PIN</button>`}
          <button class="btn small danger" data-delkid="${k.id}">Delete player</button>
        </div>
      </section>`;
    }).join('')}
    <section class="pkid">
      <h3>Backup & devices</h3>
      <p class="sub left">${acct ? 'Progress is saved to your family account and available on every device. You can also download a backup file.' : 'Progress is saved on this device. To move it to another device (or keep a backup), export here and import there.'}</p>
      <div class="row wrap">
        <button class="btn small" data-export>⬇︎ Export backup</button>
        ${acct ? '' : '<label class="btn small ghost">⬆︎ Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label><button class="btn small ghost" data-changeparentpin>Change parent PIN</button>'}<button class="btn small ghost" data-showinstall>Show install tip again</button>
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
function login(k) { ensureAvatar(k); state.kid = k; if (!k.onboarded && !k.missions && !OP_ORDER.some(op => opStats(k, op).placed)) { state.data.currentKid = k.id; save(); state.onboardStep = 0; return go('onboard'); } state.data.currentKid = k.id; save(); go('home'); }

// ---------- events ----------
function drawFlightPath() {
  const svg = $('#flightpath'), sec = svg?.parentElement; if (!svg) return;
  const k = kid(), R = sec.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`); svg.setAttribute('width', R.width); svg.setAttribute('height', R.height);
  const pts = OP_ORDER.map(op => { const el = sec.querySelector(`[data-planet="${op}"] .porb`); const r = el.getBoundingClientRect(); return { op, x: r.left - R.left + r.width / 2, y: r.top - R.top + r.height / 2, unlocked: k.unlocked.includes(op) }; });
  let d = '', paths = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, bend = (Math.abs(a.y - b.y) < 4 ? -36 : 0);
    const seg = `M${a.x},${a.y} Q${mx},${my + bend} ${b.x},${b.y}`;
    paths += `<path d="${seg}" class="fp ${b.unlocked ? 'on' : ''}" style="--c:${OPS[b.op].color}"/>`;
  }
  svg.innerHTML = paths;
}
function wire() {
  if (state.screen === 'home') requestAnimationFrame(drawFlightPath);
  const sc = $('#base-scene'); if (sc) state.baseView = mountBase(sc, kid(), { onChange: () => save() });
  const nameInput = $('#nk-name'); if (nameInput) setTimeout(() => nameInput.focus(), 50);
  const imp = $('#import-file');
  if (imp) imp.onchange = async () => {
    const f = imp.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); state.data = store.data; state.kid = null; alert('Backup imported!'); go('parent'); }
    catch (e) { alert('Could not import: ' + e.message); }
  };
}
app.addEventListener('click', e => {
  const t = e.target.closest('button, label'); if (!t) return;
  sound.unlock(); if (!state.gesture) { state.gesture = true; if (state.kid && !['login', 'parent', 'certificate'].includes(state.screen)) sound.startMusic(); }
  const d = t.dataset;
  if (d.key !== undefined) return onKey(d.key);
  if (d.go) { pinBuf = ''; return go(d.go); }
  if (d.login) { const k = store.kid(d.login); pinBuf = ''; return k.pin ? go('pin', { pinKid: k, pinMode: 'kid' }) : login(k); }
  if (d.resume) { busy(t, true); state.loginErr = ''; return account.resume(d.resume).then(afterLogin).catch(e => { if (e.status === 400 || e.status === 401 || e.status === 404) { forgetDevice(d.resume); state.loginErr = 'Please log in again.'; } else state.loginErr = e.message; render(); }); }
  if (d.kidlogin !== undefined) { busy(t, true); return account.signInKid($('#kl-user').value, $('#kl-pass').value).then(afterLogin).catch(e => { busy(t, false); formErr(e.message); }); }
  if (d.parentlogin !== undefined) { busy(t, true); return account.signInParent($('#pl-email').value.trim(), $('#pl-pass').value).then(r => { markParentAuthed(); return afterLogin(r); }).catch(e => { busy(t, false); formErr(e.message); }); }
  if (d.forgot !== undefined) { const email = $('#pl-email').value.trim(); if (!email) return formErr('Type your email first, then tap Forgot password.'); return api.fetch('/auth/v1/recover', { method: 'POST', body: { email }, auth: false }).then(() => formErr('Check your email for a reset link.')).catch(e => formErr(e.message)); }
  if (d.signup !== undefined) {
    const v = id => $(id).value.trim(); const email = v('#su-email'), password = $('#su-pass').value, name = v('#su-name'), familyName = v('#su-family'), inviteCode = v('#su-code');
    if (!email || password.length < 6 || !name) return formErr('Please fill in name, email and a 6+ character password.');
    busy(t, true); return account.signUpParent({ email, password, name, familyName, inviteCode }).then(r => { markParentAuthed(); return afterLogin(r); }).catch(e => { busy(t, false); formErr(e.message); });
  }
  if (d.joinfamily !== undefined) { const v = id => $(id).value.trim(); busy(t, true); return account.createOrJoinFamily({ name: v('#su-name'), familyName: v('#su-family'), inviteCode: v('#su-code') }).then(afterLogin).catch(e => { busy(t, false); formErr(e.message); }); }
  if (d.newpass !== undefined) { const pw = $('#np-pass').value; if (pw.length < 6) return formErr('At least 6 characters.'); busy(t, true); return api.updatePassword(pw).then(() => account.loadSelf()).then(r => { markParentAuthed(); return afterLogin(r); }).catch(e => { busy(t, false); formErr(e.message); }); }
  if (d.logout !== undefined) { return account.signOut().then(() => { state.kid = null; go('login'); }); }
  if (d.addkid !== undefined && account.enabled()) { state.editKid = null; state.draft = null; return go('addkid'); }
  if (d.editkid) { state.editKid = store.kid(d.editkid); state.draft = null; return go('addkid'); }
  if (d.savekid !== undefined) {
    const name = $('#nk-name').value.trim(), avatar = state.editKid?.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)], cfg = { ...(state.draft || randomAvatar()) };
    if (!name) return formErr('Please enter a name.');
    busy(t, true);
    const p = state.editKid
      ? account.updateKidProfile(state.editKid.id, { name, avatar }).then(() => { const k = store.kid(state.editKid.id); if (k) { k.avatarCfg = cfg; save(); } })
      : account.addKid({ username: $('#nk-user').value, password: $('#nk-pass').value, name, avatar }).then(() => { const k = store.kids().find(x => x.username === $('#nk-user').value.trim().toLowerCase()); if (k) { k.avatarCfg = cfg; save(); } });
    return p.then(() => { state.draft = null; go('parent'); }).catch(e => { busy(t, false); formErr(e.message); });
  }
  if (d.kidpass) { const k = store.kid(d.kidpass); const pw = prompt(`New password for ${k.name} (6+ characters):`); if (!pw) return; if (pw.length < 6) return alert('Too short.'); return account.setKidPassword(k.id, pw).then(() => alert('Password updated.')).catch(e => alert(e.message)); }
  if (d.addkid !== undefined) { state.draft = null; return go('newkid'); }
  if (d.createkid !== undefined) {
    const name = $('#nk-name').value.trim(), pin = $('#nk-pin').value.trim(), avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    if (!name) { $('#nk-name').focus(); $('#nk-name').classList.add('shake'); return; }
    if (pin && !/^\d{4}$/.test(pin)) { $('#nk-pin').focus(); $('#nk-pin').classList.add('shake'); return; }
    const k = store.addKid({ name, avatar, pin }); k.avatarCfg = { ...(state.draft || randomAvatar()) }; state.draft = null; save(); return login(k);
  }
  if (d.parent !== undefined) { if (account.enabled()) return go(parentAuthed() ? 'parent' : 'parentlogin'); pinBuf = ''; return go('parentpin', { pinMode: 'parent' }); }
  if (d.sound !== undefined) { state.data.settings.sound = !state.data.settings.sound; sound.setEnabled(state.data.settings.sound); save(); return render(); }
  if (d.op) { const k = kid(); if (!k) return go('login'); const st = opStats(k, d.op); return st.placed ? startMission(d.op) : startPlacement(d.op); }
  if (d.planet) { const k = kid(); if (!k) return go('login'); return opStats(k, d.planet).placed ? go('planet', { planetOp: d.planet }) : startPlacement(d.planet); }
  if (d.mixed !== undefined) return startMission('mix');
  if (d.dz) { const [part, v] = d.dz.split(':'); return dzApply(part, v); }
  if (d.dzShuffle !== undefined) { state.draft = randomAvatar(); state.draft.face = ['smile', 'grin', 'wink', 'sleepy'][Math.floor(Math.random() * 4)]; return render(); }
  if (d.unlockDone !== undefined) { return go('summary'); }
  if (d.onboardNext !== undefined) { state.onboardStep = (state.onboardStep || 0) + 1; if (state.onboardStep >= ONBOARD.length) { kid().onboarded = true; save(); state.onboardStep = 0; return startPlacement('add'); } return render(); }
  if (d.onboardSkip !== undefined) { kid().onboarded = true; save(); state.onboardStep = 0; return go('home'); }
  if (d.chest !== undefined) { const k = kid(); ensureKid(k); const done = k.daily.date === today() ? k.daily.missions : 0; if (done >= DAILY_GOAL && !k.daily.chestOpened) { k.daily.chestOpened = true; const loot = openChest(k); sound.fanfare(); confetti({ count: 200 }); return go('chest', { loot, title: 'Daily chest' }); } return go('chest', { loot: null }); }
  if (d.levelchest !== undefined) { const k = kid(); if (!k.pendingChests) return; k.pendingChests--; const loot = openChest(k); sound.fanfare(); confetti({ count: 200 }); return go('chest', { loot, title: 'Level-up chest' }); }
  if (d.basetab) { state.baseTab = d.basetab; return render(); }
  if (d.baseReset !== undefined) { state.baseView?.reset(); return; }
  if (d.buy) { const k = kid(), it = ITEMS[d.buy]; if (k.base.items.includes(d.buy)) return; if (k.stars < it.price) { $('#form-err').textContent = pick(lines.broke); sound.wrong(); return; } k.stars -= it.price; k.base.items.push(d.buy); save(); sound.coin(); confetti({ count: 60 }); render(); $('#form-err').textContent = pick(lines.buy); return; }
  if (d.avcolor) { const [part, c] = d.avcolor.split(':'); kid().avatarCfg[part] = c; save(); return render(); }
  if (d.hat) { const k = kid(), h = HATS[d.hat]; if (!k.owned.hats.includes(d.hat)) { if (k.stars < h.price) { $('#form-err').textContent = pick(lines.broke); sound.wrong(); return; } k.stars -= h.price; k.owned.hats.push(d.hat); sound.coin(); } k.avatarCfg.hat = d.hat; save(); return render(); }
  if (d.gear) { const k = kid(), g = GEAR[d.gear]; if (!k.owned.gear.includes(d.gear)) { if (k.stars < g.price) { $('#form-err').textContent = pick(lines.broke); sound.wrong(); return; } k.stars -= g.price; k.owned.gear.push(d.gear); sound.coin(); } k.avatarCfg.gear = d.gear; save(); return render(); }
  if (d.face) { const k = kid(), f = FACES[d.face]; if (!k.owned.faces.includes(d.face)) { if (k.stars < f.price) { $('#form-err').textContent = pick(lines.broke); sound.wrong(); return; } k.stars -= f.price; k.owned.faces.push(d.face); sound.coin(); } k.avatarCfg.face = d.face; save(); return render(); }
  if (d.music !== undefined) { state.data.settings.music = state.data.settings.music === false; save(); sound.setMusic(state.data.settings.music !== false); return render(); }
  if (d.race !== undefined) return go('racepick', { raceSel: [] });
  if (d.racePick) { const sel = state.raceSel || []; state.raceSel = sel.includes(d.racePick) ? sel.filter(x => x !== d.racePick) : [...sel, d.racePick].slice(-2); return render(); }
  if (d.raceGo) { const ids = d.raceGo.split(',').filter(Boolean); if (ids.length === 2) return startRace(ids); return; }
  if (d.cert) return go('certificate', { certOp: d.cert, planetOp: d.cert });
  if (d.print !== undefined) return window.print();
  if (d.speed) { const [id, sp] = d.speed.split(':'); store.kid(id).speed = sp; save(); return render(); }
  if (d.install !== undefined) { const ev = state.installEvent; if (ev) { ev.prompt(); state.installEvent = null; render(); } return; }
  if (d.showinstall !== undefined) { localStorage.removeItem('mq.installhint'); return go('login'); }
  if (d.dismissInstall !== undefined) { localStorage.setItem('mq.installhint', '1'); return render(); }
  if (d.family) { const [op, f] = d.family.split(':'); return startMission(op, Number(f)); }
  if (d.trouble) { const ids = new Set(troubleFacts(kid(), d.trouble, 8).map(t => t.fact.id)); if (!ids.size) return; return startMission(d.trouble, null, ids); }
  if (d.boss) return startBoss(d.boss);
  if (d.game) { const [g, op] = d.game.split(':'); return startGame(g, op); }
  if (d.speak !== undefined) { kid().speak = !kid().speak; save(); if (kid().speak) speak('Reading questions out loud'); return render(); }
  if (d.lightning) return startLightning(d.lightning);
  if (d.introGo !== undefined) return state.intro.then();
  if (d.quit !== undefined) { if (state.game) { state.game.destroy(); state.game = null; return go('home'); } if (state.play.mode === 'race') { state.kid = null; return go('login'); } { if (state.play.mode === 'mission' || state.play.mode === 'boss') { kid().stars += state.play.stars; kid().xp += state.play.stars; checkUnlocks(kid()); save(); } return go('home'); } return; }
  if (d.unlock) { const [id, op] = d.unlock.split(':'); const k = store.kid(id); if (!k.unlocked.includes(op)) k.unlocked.push(op); save(); return render(); }
  if (d.rescan) { const [id, op] = d.rescan.split(':'); if (!confirm(`Reset all ${OPS[op].name} progress for ${store.kid(id).name}? They'll be re-scanned next time.`)) return; store.kid(id).ops[op] = { facts: {}, placed: false }; save(); return render(); }
  if (d.delkid) { const k = store.kid(d.delkid); if (!confirm(`Delete ${k.name} and all their progress? This cannot be undone.`)) return; if (account.enabled()) return account.deleteKid(k.id).then(() => render()).catch(e => alert(e.message)); store.removeKid(k.id); if (state.kid?.id === k.id) state.kid = null; return render(); }
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
  if (e.target && e.target.matches && e.target.matches('input')) { if (e.key === 'Enter') $('.btn.primary')?.click(); return; }
  if (state.screen === 'asteroids') return;
  if (!state.gesture) { state.gesture = true; sound.unlock(); if (state.kid && !['login', 'parent', 'certificate'].includes(state.screen)) sound.startMusic(); }
  if (/^\d$/.test(e.key)) { sound.unlock(); onKey(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { onKey('⌫'); e.preventDefault(); }
  else if (e.key === 'Enter') { if (state.screen === 'play') onKey('✓'); else if (!(document.activeElement && document.activeElement.tagName === 'BUTTON')) $('.btn.primary')?.click(); }
  else if (e.key === 'Escape' && state.screen === 'play') $('[data-quit]')?.click();
});
// prevent double-tap zoom / long-press menus on iPad
const touchStarts = new Map();
document.addEventListener('touchstart', e => { for (const t of e.changedTouches) touchStarts.set(t.identifier, [t.clientX, t.clientY]); }, { passive: true });
document.addEventListener('touchend', e => { const k = e.target.closest('.key'); const t = e.changedTouches[0]; const s0 = t && touchStarts.get(t.identifier); if (t) touchStarts.delete(t.identifier); if (!k) return; if (s0 && Math.hypot(t.clientX - s0[0], t.clientY - s0[1]) > 12) return; e.preventDefault(); k.click(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (e.target.closest('.key, .btn')) e.preventDefault(); });

function playSecs(p) { return Math.min(3600, Math.round((Date.now() - (p.startedAt || Date.now())) / 1000)); }
function logActivity(k, kind, p, correct) { k.history.push({ t: Date.now(), kind, op: p.op, n: p.results.length, c: correct, stars: p.stars, secs: playSecs(p) }); if (k.history.length > 600) k.history.shift(); }
function fmtMins(secs) { const m = Math.round(secs / 60); if (secs > 0 && m < 1) return "<1 min"; return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; }
function weeklyRow(k) {
  const now = Date.now(), wk = 7 * 86400e3, cur = periodStats(k, now - wk, now + 1), prev = periodStats(k, now - 2 * wk, now - wk);
  const acc = s => s.n ? Math.round(s.c / s.n * 100) + '%' : '—';
  const delta = (a, b) => b === 0 && a === 0 ? '' : a > b ? `<i class="up">▲ ${a - b}</i>` : a < b ? `<i class="down">▼ ${b - a}</i>` : '<i>=</i>';
  const todayS = periodStats(k, new Date().setHours(0, 0, 0, 0), now + 1);
  return `<div class="weekly"><b>Today</b> <span>⏱ ${fmtMins(todayS.secs)}</span><span>${todayS.missions} mission${todayS.missions === 1 ? '' : 's'}</span><span>${acc(todayS)} correct</span></div>
  <div class="weekly"><b>This week</b>
    <span>⏱ ${fmtMins(cur.secs)} ${delta(Math.round(cur.secs / 60), Math.round(prev.secs / 60))}</span>
    <span>${cur.missions} mission${cur.missions === 1 ? '' : 's'} ${delta(cur.missions, prev.missions)}</span>
    <span>${cur.days} day${cur.days === 1 ? '' : 's'} played ${delta(cur.days, prev.days)}</span>
    <span>${acc(cur)} correct${prev.n ? ` <small>(last week ${acc(prev)})</small>` : ''}</span>
    <span>${cur.known} facts newly known ${delta(cur.known, prev.known)}</span>
    <span>${cur.mastered} mastered ${delta(cur.mastered, prev.mastered)}</span>
    <span>⭐ ${cur.stars}</span></div>`;
}
function syncText() { const st = account.status.state; return st === 'offline' ? '📴 offline — will sync later' : st === 'error' ? '⚠️ ' + account.status.error : '☁️ saved to cloud'; }
document.addEventListener('mq:sync', () => { const h = document.querySelector('.topbar .who small'); if (h && state.screen === 'parent') h.textContent = `${account.family?.name || ''} · ${account.me?.name || ''} · ${syncText()}`; });
store.onSave = ids => account.schedulePush(ids);
addEventListener('pagehide', () => account.flush());
addEventListener('resize', () => { if (state.screen === 'home') drawFlightPath(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && account.enabled() && account.isKid() && state.kid && !state.game && !['play', 'asteroids', 'intro'].includes(state.screen)) account.loadMyProgress().then(k => { state.kid = k; render(); }).catch(() => {}); });

// ---------- boot ----------
screens.pin = screens.pin; // (defined above)
state.pinMode = 'kid';
if (account.enabled()) {
  const rec = api.sessionFromHash();
  api.load();
  if (rec) { api.setSession(rec); state.screen = 'newpass'; }
  render();
  if (rec) { /* recovery: stay on the new-password screen */ }
  else
  if (api.session) account.loadSelf().then(r => afterLogin(r, { boot: true })).catch(() => { /* offline: fall back to cached kid */ const last = state.data.currentKid && store.kid(state.data.currentKid); if (last && api.session?.user?.id === last.id) { state.kid = last; go('home'); } });
} else {
  const last = state.data.currentKid && store.kid(state.data.currentKid);
  if (last && !last.pin) { state.kid = last; state.screen = 'home'; }
  render();
}
