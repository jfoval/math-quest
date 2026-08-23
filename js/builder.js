// "Build the answer" games: Smoothie Shop (add/sub with ten-frames) and Array Farm (mul/div with arrays).
// The kid constructs the quantity; fluency comes later, understanding comes first. No timers.
import { Session } from './engine.js';
import { OPS } from './facts.js';
import { sound } from './sound.js';
import { burst, confetti } from './confetti.js';

const CUSTOMERS = ['🐸', '🐙', '🦖', '👾', '🐨', '🦊', '🐼', '🤖', '🦄', '🐯'];
const FRUIT = { a: '🍓', b: '🫐' };

export class Builder {
  constructor({ kid, op, root, onEnd, speak }) {
    Object.assign(this, { kid, op, root, onEnd, speak });
    this.kind = (op === 'add' || op === 'sub') ? 'smoothie' : 'farm';
    this.sess = new Session(kid, op); this.total = 8; this.index = 0; this.results = []; this.stars = 0; this.combo = 0; this.maxCombo = 0; this.alive = true;
    this.nextQ();
  }
  destroy() { this.alive = false; }
  hud() {
    const o = OPS[this.op];
    return `<header class="topbar play">
      <button class="iconbtn" data-quit title="Quit">✕</button>
      <div class="progress"><div class="dots">${Array.from({ length: this.total }, (_, i) => `<i class="${this.results[i] ? (this.results[i].correct ? 'ok' : 'bad') : ''} ${i === this.index ? 'cur' : ''}"></i>`).join('')}</div>
      <small>${this.kind === 'smoothie' ? '🥤 Smoothie Shop' : '🌱 Array Farm'} · ${o.planet}</small></div>
      <div class="stars" id="play-stars">⭐ ${this.stars}</div></header>`;
  }
  nextQ() {
    if (!this.alive) return;
    if (this.index >= this.total) return this.end();
    this.q = this.sess.next(); this.t0 = performance.now(); this.busy = false;
    this.speak?.(this.q);
    this.kind === 'smoothie' ? this.renderSmoothie() : this.renderFarm();
  }

  // ---------- Smoothie Shop ----------
  renderSmoothie() {
    const q = this.q, isAdd = this.op === 'add';
    this.cust = CUSTOMERS[this.index % CUSTOMERS.length];
    // add: a strawberries pre-loaded, kid adds blueberries.  sub: a fruits loaded, kid takes some away.
    this.count = isAdd ? q.a : q.a; this.added = 0; this.removed = 0;
    const ask = isAdd ? `I'd like <b>${q.a} + ${q.b}</b> fruits, please!` : `I have <b>${q.a}</b> fruits. Take away <b>${q.b}</b> and blend the rest!`;
    this.root.innerHTML = `${this.hud()}
      <div class="shop">
        <div class="customer"><span class="face">${this.cust}</span><div class="bubble" id="bubble">${ask}</div></div>
        <div class="frames" id="frames"></div>
        <div class="shop-controls">
          ${isAdd ? `<div class="row"><button class="btn fruitbtn" data-add>＋ ${FRUIT.b} Add one</button><button class="btn ghost fruitbtn" data-undo>Undo</button></div>` : `<p class="sub" style="margin:0">Tap fruits to take them away</p>`}
          <button class="btn primary huge" data-blend>🥤 Blend it!</button>
        </div>
        <div class="feedback" id="feedback"></div>
      </div>`;
    this.drawFrames();
    this.root.querySelector('[data-add]')?.addEventListener('click', () => { if (this.busy || this.added >= 20) return; this.added++; sound.tap(); this.drawFrames(); });
    this.root.querySelector('[data-undo]')?.addEventListener('click', () => { if (this.busy || !this.added) return; this.added--; this.drawFrames(); });
    this.root.querySelector('[data-blend]').addEventListener('click', () => this.checkSmoothie());
    this.root.querySelector('#frames').addEventListener('click', e => { const c = e.target.closest('.cell.has'); if (!c || this.busy || this.op !== 'sub') return; c.classList.toggle('gone'); sound.tap(); this.drawCount(); });
  }
  drawFrames() {
    const q = this.q, isAdd = this.op === 'add', totalShown = isAdd ? q.a + this.added : q.a;
    const cells = [];
    for (let i = 0; i < 20; i++) {
      const has = i < totalShown, kind = isAdd ? (i < q.a ? 'a' : 'b') : 'a';
      cells.push(`<span class="cell ${has ? 'has' : ''}">${has ? FRUIT[kind] : ''}</span>`);
    }
    this.root.querySelector('#frames').innerHTML = `<div class="tenframe">${cells.slice(0, 10).join('')}</div><div class="tenframe">${cells.slice(10).join('')}</div><div class="count" id="count"></div>`;
    this.drawCount();
  }
  currentCount() { return this.op === 'add' ? this.q.a + this.added : this.q.a - this.root.querySelectorAll('.cell.gone').length; }
  drawCount() { const n = this.currentCount(); const el = this.root.querySelector('#count'); if (el) el.innerHTML = this.op === 'add' ? `${this.q.a} + <b>${this.added}</b> = ?` : `${this.q.a} − <b>${this.root.querySelectorAll('.cell.gone').length}</b> = ?`; }
  checkSmoothie() {
    if (this.busy) return; this.busy = true;
    const n = this.currentCount(), correct = n === this.q.ans, ms = performance.now() - this.t0;
    const fb = this.root.querySelector('#feedback'), bubble = this.root.querySelector('#bubble');
    this.record(correct, ms);
    if (correct) { bubble.innerHTML = `Mmm! <b>${this.q.text} = ${this.q.ans}</b>. Perfect smoothie! 🥤`; fb.innerHTML = `<span class="pop">+${this.lastGain} ⭐</span>`; this.root.querySelector('.face').classList.add('happy'); }
    else { bubble.innerHTML = `Yuck, that's ${n}! I wanted <b>${this.q.text} = ${this.q.ans}</b>. 🤢`; fb.innerHTML = '<span class="pop bad">Look at the frames: count again next time!</span>'; this.root.querySelector('.face').classList.add('sad'); }
    setTimeout(() => { this.index++; this.nextQ(); }, correct ? 1300 : 2200);
  }

  // ---------- Array Farm ----------
  renderFarm() {
    const q = this.q, isMul = this.op === 'mul';
    this.rows = 0; this.cols = isMul ? 0 : q.b; this.max = 12;
    const ask = isMul ? `Plant <b>${q.a} row${q.a === 1 ? '' : 's'} of ${q.b}</b>. How many seeds is that?` : `Plant <b>${q.a} seeds</b> in rows of <b>${q.b}</b>. How many rows?`;
    this.root.innerHTML = `${this.hud()}
      <div class="farm">
        <div class="customer"><span class="face">🧑‍🌾</span><div class="bubble" id="bubble">${ask}</div></div>
        <div class="plot-wrap"><div class="plot" id="plot" style="grid-template-columns:repeat(${this.max},1fr)">${Array.from({ length: this.max * this.max }, (_, i) => `<i data-r="${Math.floor(i / this.max) + 1}" data-c="${i % this.max + 1}"></i>`).join('')}</div>
          <div class="plot-labels" id="labels"></div></div>
        <div class="plot-info" id="info">Drag across the field to plant</div>
        <div class="farm-answer"><span id="farm-q">${isMul ? `${q.a} × ${q.b} =` : `${q.a} ÷ ${q.b} =`}</span><input id="farm-in" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="?"><button class="btn primary" data-harvest>🌾 Harvest</button></div>
        <div class="feedback" id="feedback"></div>
      </div>`;
    const plot = this.root.querySelector('#plot');
    const setFromEvent = e => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#plot i'); if (!el) return; this.rows = +el.dataset.r; if (isMul) this.cols = +el.dataset.c; this.paint(); };
    let down = false;
    plot.addEventListener('pointerdown', e => { if (this.busy) return; down = true; try { plot.setPointerCapture(e.pointerId); } catch {} setFromEvent(e); });
    plot.addEventListener('pointermove', e => { if (down && !this.busy) setFromEvent(e); });
    plot.addEventListener('pointerup', () => { down = false; });
    plot.addEventListener('pointercancel', () => { down = false; });
    this.root.querySelector('[data-harvest]').addEventListener('click', () => this.checkFarm());
    this.root.querySelector('#farm-in').addEventListener('keydown', e => { if (e.key === 'Enter') this.checkFarm(); });
    this.paint();
  }
  paint() {
    const cells = this.root.querySelectorAll('#plot i'); const r = this.rows, c = this.cols;
    cells.forEach(el => el.classList.toggle('on', +el.dataset.r <= r && +el.dataset.c <= c));
    const n = r * c, isMul = this.op === 'mul';
    this.root.querySelector('#labels').innerHTML = Array.from({ length: r }, (_, i) => `<b style="top:${(i + 0.5) / this.max * 100}%">${(i + 1) * c}</b>`).join('');
    const info = this.root.querySelector('#info');
    info.innerHTML = r && c ? `<b>${r}</b> row${r === 1 ? '' : 's'} of <b>${c}</b> = <b>${n}</b> seeds${!isMul && n === this.q.a ? ' ✅' : ''}` : 'Drag across the field to plant';
  }
  checkFarm() {
    if (this.busy) return;
    const v = parseInt(this.root.querySelector('#farm-in').value, 10); if (Number.isNaN(v)) { this.root.querySelector('#farm-in').focus(); return; }
    this.busy = true;
    const correct = v === this.q.ans, ms = performance.now() - this.t0, fb = this.root.querySelector('#feedback'), bubble = this.root.querySelector('#bubble');
    // show the correct array so the kid sees it either way
    if (this.op === 'mul') { this.rows = this.q.a; this.cols = this.q.b; } else { this.rows = this.q.ans; this.cols = this.q.b; }
    this.paint();
    this.record(correct, ms);
    if (correct) { bubble.innerHTML = `Great harvest! <b>${this.q.text} = ${this.q.ans}</b> 🌾`; fb.innerHTML = `<span class="pop">+${this.lastGain} ⭐</span>`; }
    else { bubble.innerHTML = `Not ${v} — look: <b>${this.q.text} = ${this.q.ans}</b>`; fb.innerHTML = `<span class="pop bad">${this.op === 'mul' ? `${this.q.a} rows of ${this.q.b} make ${this.q.ans}` : `${this.q.a} seeds in rows of ${this.q.b} make ${this.q.ans} rows`}</span>`; }
    setTimeout(() => { this.index++; this.nextQ(); }, correct ? 1300 : 2600);
  }

  record(correct, ms) {
    this.results.push({ fact: this.q.fact, correct, ms });
    if (correct) { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); const r = this.sess.answer(this.q, true, ms, this.combo); this.lastGain = Math.max(10, r.stars); this.stars += this.lastGain; sound.correct(this.combo); const el = this.root.querySelector('#feedback'); const b = el.getBoundingClientRect(); burst(b.left + b.width / 2, b.top); if (this.combo % 4 === 0) confetti({ count: 40 }); }
    else { this.combo = 0; this.sess.answer(this.q, false, ms, 0); sound.wrong(); }
    this.root.querySelector('#play-stars').textContent = `⭐ ${this.stars}`;
  }
  end() { this.destroy(); this.onEnd({ results: this.results, stars: this.stars, maxCombo: this.maxCombo, op: this.op, kind: this.kind }); }
}
