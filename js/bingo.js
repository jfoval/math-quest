// Bingo Bugs: a 5×5 card of answers. Solve the fact, tap its answer. Five in a row wins.
import { Session } from './engine.js';
import { OPS } from './facts.js';
import { sound } from './sound.js';
import { burst, confetti } from './confetti.js';
import { distractors } from './asteroids.js';

const BUGS = ['🐞', '🦋', '🐝', '🐛', '🪲', '🦗', '🐌', '🕷️', '🪰', '🐜'];

export class Bingo {
  constructor({ kid, op, root, onEnd, speak }) {
    Object.assign(this, { kid, op, root, onEnd, speak });
    this.sess = new Session(kid, op); this.results = []; this.stars = 0; this.combo = 0; this.maxCombo = 0; this.alive = true; this.marked = new Set(); this.lines = 0;
    // Pre-draw 25 facts so every cell is reachable; ask them in order, replacing answered cells' facts.
    this.queue = Array.from({ length: 40 }, () => this.sess.next());
    const answers = []; const seen = new Set();
    for (const q of this.queue) { if (!seen.has(q.ans) && answers.length < 25) { seen.add(q.ans); answers.push(q.ans); } }
    let guard = 0;
    while (answers.length < 25 && guard++ < 200) for (const d of distractors(this.queue[guard % this.queue.length].fact, 5)) if (!seen.has(d) && answers.length < 25) { seen.add(d); answers.push(d); }
    for (let v = 0; answers.length < 25 && v < 200; v++) if (!seen.has(v)) { seen.add(v); answers.push(v); }
    this.cells = answers.sort(() => Math.random() - .5);
    this.render(); this.nextQ();
  }
  destroy() { this.alive = false; }
  render() {
    const o = OPS[this.op];
    this.root.innerHTML = `<header class="topbar play">
      <button class="iconbtn" data-quit title="Quit">✕</button>
      <div class="progress"><div class="bingo-q" id="bq"></div><small>🐞 Bingo Bugs · ${o.planet} · <span id="blines">0 lines</span></small></div>
      <div class="stars" id="play-stars">⭐ 0</div></header>
      <div class="bingo-wrap"><div class="bingo" id="card">${this.cells.map((v, i) => `<button class="bcell" data-i="${i}">${v}</button>`).join('')}</div>
      <div class="feedback" id="feedback"></div></div>`;
    this.root.querySelector('#card').addEventListener('click', e => { const c = e.target.closest('.bcell'); if (c) this.tap(+c.dataset.i); });
  }
  nextQ() {
    if (!this.alive) return;
    // pick the next queued fact whose answer is on an unmarked cell
    let q = null;
    for (let i = 0; i < this.queue.length; i++) { const cand = this.queue[i]; const idx = this.cells.indexOf(cand.ans); if (idx >= 0 && !this.marked.has(idx)) { q = cand; this.queue.splice(i, 1); break; } }
    if (!q) { const free = this.cells.map((v, i) => i).filter(i => !this.marked.has(i)); if (!free.length) return this.end(true); // fill remaining with fresh facts matching
      let tries = 0; while (!q && tries++ < 60) { const c = this.sess.next(); const idx = this.cells.indexOf(c.ans); if (idx >= 0 && !this.marked.has(idx)) q = c; }
      if (!q) return this.end(this.lines > 0); }
    this.q = q; this.t0 = performance.now(); this.busy = false;
    this.root.querySelector('#bq').innerHTML = `${q.a} <span style="color:${OPS[this.op].color}">${q.sym}</span> ${q.b} = ?`;
    this.speak?.(q);
  }
  tap(i) {
    if (this.busy || this.marked.has(i)) return;
    const ms = performance.now() - this.t0, correct = this.cells[i] === this.q.ans, cell = this.root.querySelector(`[data-i="${i}"]`);
    this.busy = true; this.results.push({ fact: this.q.fact, correct, ms });
    if (correct) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const r = this.sess.answer(this.q, true, ms, this.combo); this.stars += r.stars;
      this.marked.add(i); cell.classList.add('on'); cell.innerHTML = `<span class="bug">${BUGS[this.marked.size % BUGS.length]}</span><small>${this.cells[i]}</small>`;
      const b = cell.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2); sound.correct(this.combo);
      const newLines = this.countLines();
      if (newLines > this.lines) { this.lines = newLines; this.stars += 50; sound.fanfare(); confetti({ count: 120 }); this.root.querySelector('#feedback').innerHTML = '<span class="pop">🎉 BINGO! +50 ⭐</span>'; }
      else this.root.querySelector('#feedback').innerHTML = `<span class="pop">+${r.stars} ⭐</span>`;
      this.root.querySelector('#blines').textContent = `${this.lines} line${this.lines === 1 ? '' : 's'}`;
      this.root.querySelector('#play-stars').textContent = `⭐ ${this.stars}`;
      if (this.lines >= 2 || this.marked.size >= 25) return setTimeout(() => this.end(true), 900);
      setTimeout(() => this.nextQ(), 500);
    } else {
      this.combo = 0; this.sess.answer(this.q, false, ms, 0); sound.wrong();
      cell.classList.add('shake'); setTimeout(() => cell.classList.remove('shake'), 400);
      const right = this.root.querySelector(`[data-i="${this.cells.indexOf(this.q.ans)}"]`); right?.classList.add('hint');
      this.root.querySelector('#feedback').innerHTML = `<span class="pop bad">${this.q.text} = ${this.q.ans}</span>`;
      setTimeout(() => { right?.classList.remove('hint'); this.root.querySelector('#feedback').innerHTML = ''; this.nextQ(); }, 1600);
    }
  }
  countLines() {
    const m = i => this.marked.has(i); let n = 0;
    for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every(c => m(r * 5 + c))) n++;
    for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every(r => m(r * 5 + c))) n++;
    if ([0, 6, 12, 18, 24].every(m)) n++; if ([4, 8, 12, 16, 20].every(m)) n++;
    return n;
  }
  end(won) { this.destroy(); this.onEnd({ results: this.results, stars: this.stars, maxCombo: this.maxCombo, op: this.op, kind: 'bingo', lines: this.lines, won }); }
}
