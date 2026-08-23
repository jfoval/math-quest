// Learning engine: placement test + Leitner-style spaced repetition per fact.
// box 0 = not known, 5 = mastered. Each correct+fast answer moves a fact up a box; a miss knocks it down.
import { allFacts, makeQuestion, OPS, OP_ORDER } from './facts.js';

const MIN = 60e3, DAY = 86400e3;
export const INTERVALS = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY]; // per box
export const KNOWN_BOX = 3;          // counts as "known" for unlocking the next operation
export const UNLOCK_RATIO = 0.85;    // 85% of facts known → next op unlocks
export const MISSION_LENGTH = 20;

export const SPEEDS = { relaxed: 1.6, normal: 1, fast: 0.7 };
export function speedLimit(op, kid) { const base = (op === 'add' || op === 'sub') ? 4000 : 6000; return base * (SPEEDS[kid?.speed] || 1); } // ms for "fast"

export function opData(kid, op) {
  kid.ops[op] ||= { facts: {}, placed: false };
  return kid.ops[op];
}
export function factState(kid, op, id) {
  const d = opData(kid, op);
  return d.facts[id] ||= { box: 0, streak: 0, seen: 0, correct: 0, ms: [], due: 0, last: 0 };
}

export function opStats(kid, op) {
  const facts = allFacts(op), d = opData(kid, op), now = Date.now();
  let boxSum = 0, known = 0, mastered = 0, due = 0, seen = 0;
  for (const f of facts) {
    const s = d.facts[f.id];
    const box = s ? s.box : 0;
    boxSum += box;
    if (box >= KNOWN_BOX) known++;
    if (box >= 5) mastered++;
    if (s && s.seen) seen++;
    if (box > 0 && s.due <= now) due++;
  }
  return { total: facts.length, known, mastered, due, seen, pct: boxSum / (facts.length * 5), placed: d.placed };
}

// Unlock next operations whose predecessor is ≥85% known. Returns array of newly unlocked op keys.
export function checkUnlocks(kid) {
  const fresh = [];
  for (let i = 0; i < OP_ORDER.length - 1; i++) {
    const op = OP_ORDER[i], next = OP_ORDER[i + 1];
    if (!kid.unlocked.includes(op) || kid.unlocked.includes(next)) continue;
    const st = opStats(kid, op);
    if (st.placed && st.known / st.total >= UNLOCK_RATIO) { kid.unlocked.push(next); fresh.push(next); }
  }
  return fresh;
}

// Which op should the kid be working on by default: the first unlocked op that is not yet ≥85% known,
// else the last unlocked one (review mode).
export function suggestedOp(kid) {
  for (const op of OP_ORDER) {
    if (!kid.unlocked.includes(op)) break;
    const st = opStats(kid, op);
    if (!st.placed || st.known / st.total < UNLOCK_RATIO) return op;
  }
  return kid.unlocked[kid.unlocked.length - 1];
}

// ---------- Placement test ----------
export function placementQuestions(op) {
  const facts = allFacts(op);
  const families = [...new Set(facts.map(f => f.family))].sort((a, b) => a - b);
  const picked = [];
  for (const fam of families) {
    const pool = shuffle(facts.filter(f => f.family === fam));
    const n = fam <= 1 ? 1 : pool.length >= 12 ? 3 : 2; // bigger families get sampled more before we infer
    picked.push(...pool.slice(0, n));
  }
  return shuffle(picked).map(makeQuestion);
}

// results: [{fact, correct, ms}]
export function applyPlacement(kid, op, results) {
  const d = opData(kid, op), limit = speedLimit(op, kid), now = Date.now();
  const byFam = {};
  for (const r of results) (byFam[r.fact.family] ||= []).push(r);
  for (const f of allFacts(op)) {
    const rs = byFam[f.family] || [];
    const allRight = rs.length && rs.every(r => r.correct);
    const allFast = allRight && rs.every(r => r.ms <= limit);
    const s = factState(kid, op, f.id);
    const mine = rs.find(r => r.fact.id === f.id);
    let box;
    if (allFast) box = 3;          // whole family looks solid → known, will be confirmed on review
    else if (allRight) box = 1;    // knows it but slow → practice
    else if (mine && mine.correct) box = mine.ms <= limit ? 2 : 1;
    else box = 0;
    s.box = box; s.due = now + (box ? Math.min(INTERVALS[box], DAY) : 0);
    if (box >= KNOWN_BOX && !s.knownAt) s.knownAt = now;
    if (mine) { s.seen = 1; s.correct = mine.correct ? 1 : 0; s.streak = mine.correct ? 1 : 0; s.ms = [mine.ms]; s.last = now; }
  }
  d.placed = true;
}

// ---------- Mission question selection ----------
export class Session {
  constructor(kid, op, family = null, filter = null) {
    this.kid = kid; this.op = op; this.count = 0; this.family = family; this.filter = filter;
    this.recent = []; this.retry = []; this.active = new Set(); this.newIntroduced = 0;
  }
  next() {
    const { kid, op } = this, now = Date.now();
    let facts = this.family == null ? allFacts(op) : allFacts(op).filter(f => f.family === this.family);
    if (this.filter) { const ff = facts.filter(this.filter); if (ff.length) facts = ff; }
    const d = opData(kid, op);
    this.count++;
    // 1) re-ask a missed fact after a short gap
    const r = this.retry.find(x => x.at <= this.count);
    if (r) { this.retry = this.retry.filter(x => x !== r); return this.q(r.fact); }
    const notRecent = f => !this.recent.slice(-3).includes(f.id);
    const st = id => d.facts[id] || { box: 0, due: 0, last: 0 };
    // facts currently being learned this session (stay here until "known")
    for (const id of this.active) if (st(id).box >= KNOWN_BOX) this.active.delete(id);
    const learning = facts.filter(f => this.active.has(f.id) && notRecent(f));
    const due = facts.filter(f => !this.active.has(f.id) && st(f.id).box > 0 && st(f.id).due <= now && notRecent(f));
    const fresh = facts.filter(f => !this.active.has(f.id) && st(f.id).box === 0);
    const roll = Math.random();
    let pick = null;
    const introduce = () => { // easiest family first, with a little variety
      fresh.sort((a, b) => a.family - b.family || a.ans - b.ans);
      const f = fresh[Math.floor(Math.random() * Math.min(3, fresh.length))];
      this.active.add(f.id); this.newIntroduced++;
      if (!st(f.id).seen) { this.teach = f; this.retry.push({ fact: f, at: this.count + 2 + Math.floor(Math.random() * 2) }); }
      return f;
    };
    if (learning.length && roll < 0.45) pick = rand(learning);
    else if (due.length && roll < 0.8) pick = weightedLowBox(due, st);
    else if (fresh.length && this.active.size < 3) pick = introduce();
    else if (learning.length) pick = rand(learning);
    else if (due.length) pick = weightedLowBox(due, st);
    else if (fresh.length) pick = introduce();
    else { // everything known & nothing due: spot-check least recently seen
      let pool = facts.filter(notRecent).sort((a, b) => st(a.id).last - st(b.id).last).slice(0, 8);
      if (!pool.length) pool = facts.length ? facts : allFacts(op);   // tiny sets (e.g. the +0s) would otherwise run dry
      pick = rand(pool);
    }
    return this.q(pick);
  }
  q(fact) { this.recent.push(fact.id); const q = makeQuestion(fact); if (this.teach === fact) { q.teach = true; this.teach = null; } return q; }

  // returns { fast, boxBefore, boxAfter, stars }
  answer(question, correct, ms, combo) {
    const { kid, op } = this, fact = question.fact, now = Date.now();
    const s = factState(kid, op, fact.id), before = s.box, limit = speedLimit(op, kid);
    s.seen++; s.last = now; s.ms.push(ms); if (s.ms.length > 5) s.ms.shift();
    const fast = correct && ms <= limit;
    if (correct) {
      s.correct++; s.streak++;
      if (fast) s.box = Math.min(5, s.box + 1);
      else s.box = Math.max(1, s.box >= 2 ? s.box : 1);
    } else {
      s.streak = 0; s.box = Math.max(0, s.box - 2);
      this.active.add(fact.id);
      this.retry.push({ fact, at: this.count + 2 + Math.floor(Math.random() * 2) });
    }
    s.due = now + INTERVALS[s.box];
    if (s.box >= KNOWN_BOX && !s.knownAt) s.knownAt = now;
    if (s.box >= 5 && !s.masteredAt) s.masteredAt = now;
    let stars = 0;
    if (correct) {
      const mult = combo >= 10 ? 3 : combo >= 4 ? 2 : 1;
      stars = (fast ? 15 : 10) * mult;
    }
    return { fast, boxBefore: before, boxAfter: s.box, stars };
  }
}

// Interleaves several operations in one mission. Ops with more due reviews get asked more.
export class MixedSession {
  constructor(kid, ops) { this.kid = kid; this.ops = ops; this.sessions = Object.fromEntries(ops.map(op => [op, new Session(kid, op)])); }
  next() {
    const weights = this.ops.map(op => { const st = opStats(this.kid, op); return 1 + st.due + (st.total - st.known) * 0.2; });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), op = this.ops[0];
    for (let i = 0; i < this.ops.length; i++) { r -= weights[i]; if (r <= 0) { op = this.ops[i]; break; } }
    return this.sessions[op].next();
  }
  answer(q, correct, ms, combo) { return this.sessions[q.fact.op].answer(q, correct, ms, combo); }
}
// Activity summary for a window [from, to): missions, accuracy, facts newly known / mastered (all ops).
export function periodStats(kid, from, to) {
  const h = kid.history.filter(x => x.t >= from && x.t < to);
  const out = { missions: h.filter(x => !x.kind || x.kind === 'mission').length, n: h.reduce((a, x) => a + x.n, 0), c: h.reduce((a, x) => a + x.c, 0), stars: h.reduce((a, x) => a + (x.stars || 0), 0), secs: h.reduce((a, x) => a + (x.secs || 0), 0), known: 0, mastered: 0, days: new Set(h.map(x => new Date(x.t).toDateString())).size };
  for (const op of OP_ORDER) for (const s of Object.values(kid.ops[op]?.facts || {})) { if (s.knownAt >= from && s.knownAt < to) out.known++; if (s.masteredAt >= from && s.masteredAt < to) out.mastered++; }
  return out;
}
export function familyStats(kid, op) {
  const d = opData(kid, op), out = {};
  for (const f of allFacts(op)) { const o = out[f.family] ||= { total: 0, boxSum: 0, known: 0 }; o.total++; const b = d.facts[f.id]?.box || 0; o.boxSum += b; if (b >= KNOWN_BOX) o.known++; }
  return out;
}
// Boss fights test what the kid (mostly) knows: known facts plus a sprinkle of learning ones.
export function bossPool(kid, op) {
  const d = opData(kid, op), box = f => d.facts[f.id]?.box || 0;
  const known = allFacts(op).filter(f => box(f) >= 2), learning = allFacts(op).filter(f => box(f) === 1);
  const pool = known.length >= 8 ? known.concat(learning.slice(0, Math.ceil(known.length / 4))) : allFacts(op).filter(f => f.family <= 5);
  return pool;
}
export function lightningPool(kid, op) {
  const d = opData(kid, op);
  const pool = allFacts(op).filter(f => (d.facts[f.id]?.box || 0) >= 2);
  return pool.length >= 8 ? pool : allFacts(op).filter(f => f.family <= 5);
}

export function levelFor(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
export function xpForLevel(l) { return (l - 1) ** 2 * 60; }

function weightedLowBox(list, st) {
  const minBox = Math.min(...list.map(f => st(f.id).box));
  const low = list.filter(f => st(f.id).box <= minBox + 1);
  return rand(low.length ? low : list);
}
const rand = a => a[Math.floor(Math.random() * a.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export { OPS, OP_ORDER };
