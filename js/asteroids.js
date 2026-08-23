// Asteroid Blaster: the question sits on your ship, numbered asteroids drift down. Tap the right one.
import { Session, speedLimit } from './engine.js';
import { OPS } from './facts.js';
import { sound } from './sound.js';
import { burst, confetti } from './confetti.js';
import { rocket } from './art.js';

export function distractors(fact, n = 3) {
  const { op, a, b, ans } = fact, set = new Set();
  const cands = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10];
  if (op === 'add') cands.push(a + b + 1, Math.abs(a - b), a * b);
  if (op === 'sub') cands.push(a + b, a - b + 1, Math.abs(b - (a - b)));
  if (op === 'mul') cands.push(a * (b + 1), a * (b - 1), (a + 1) * b, a + b, ans + a, ans - b);
  if (op === 'div') cands.push(ans + 1, ans - 1, b, a - b, Math.round(a / (b + 1)));
  for (const c of cands.sort(() => Math.random() - .5)) { if (set.size >= n) break; if (Number.isInteger(c) && c >= 0 && c !== ans && c < 200) set.add(c); }
  while (set.size < n) { const c = ans + Math.floor(Math.random() * 9) - 4; if (c >= 0 && c !== ans) set.add(c); }
  return [...set];
}

export class Asteroids {
  constructor({ kid, op, root, onEnd, speak }) {
    this.kid = kid; this.op = op; this.root = root; this.onEnd = onEnd; this.speak = speak;
    this.sess = new Session(kid, op); this.total = 12; this.index = 0; this.shields = 3; this.stars = 0; this.combo = 0; this.maxCombo = 0;
    this.results = []; this.rocks = []; this.busy = false; this.alive = true;
    this.fall = speedLimit(op, kid) * 2.2; // ms for a rock to cross the field
    this.render(); this.nextQ();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    this.keys = e => { if (/^[1-4]$/.test(e.key)) { const r = this.rocks[+e.key - 1]; if (r) this.hit(r); } };
    addEventListener('keydown', this.keys);
  }
  render() {
    const o = OPS[this.op];
    this.root.innerHTML = `
      <header class="topbar play">
        <button class="iconbtn" data-quit title="Quit">✕</button>
        <div class="progress"><div class="dots" id="ab-dots"></div><small>☄️ Asteroid Blaster · ${o.planet} · <span id="ab-shields"></span></small></div>
        <div class="stars" id="play-stars">⭐ 0</div>
      </header>
      <div class="field" id="field">
        <div class="combo" id="combo"></div>
        <div class="rocks" id="rocks"></div>
        <div class="ship-base"><div class="ship-q" id="ab-q"></div>${rocket(64)}</div>
        <div class="laser" id="laser"></div>
        <div class="shield-flash" id="flash"></div>
      </div>
      <p class="sub hintline">Tap the right asteroid<span class="kbd-only"> — or press 1–4</span></p>`;
    this.rocksEl = this.root.querySelector('#rocks'); this.field = this.root.querySelector('#field');
    this.field.addEventListener('click', e => { const r = e.target.closest('.rock'); if (r) this.hit(this.rocks.find(x => x.el === r)); });
    this.updateHud();
  }
  updateHud() {
    this.root.querySelector('#ab-shields').innerHTML = '🛡️'.repeat(this.shields) + '<span style="opacity:.3">🛡️</span>'.repeat(3 - this.shields);
    this.root.querySelector('#ab-dots').innerHTML = Array.from({ length: this.total }, (_, i) => `<i class="${this.results[i] ? (this.results[i].correct ? 'ok' : 'bad') : ''} ${i === this.index ? 'cur' : ''}"></i>`).join('');
    this.root.querySelector('#play-stars').textContent = `⭐ ${this.stars}`;
    const c = this.root.querySelector('#combo'); c.textContent = this.combo >= 3 ? `🔥 ${this.combo} combo!` : ''; c.className = 'combo' + (this.combo >= 3 ? ' show' : '');
  }
  nextQ() {
    if (!this.alive) return;
    if (this.index >= this.total || this.shields <= 0) return this.end();
    this.q = this.sess.next(); this.t0 = performance.now(); this.busy = false;
    this.root.querySelector('#ab-q').innerHTML = `${this.q.a} <span style="color:${OPS[this.op].color}">${this.q.sym}</span> ${this.q.b} = ?`;
    this.speak?.(this.q);
    const answers = [this.q.ans, ...distractors(this.q.fact, 3)].sort(() => Math.random() - .5);
    const W = this.rocksEl.clientWidth || 600;
    const slot = W / answers.length;
    this.rocks.forEach(r => r.el.remove()); this.rocks = [];
    answers.forEach((v, i) => {
      const el = document.createElement('button'); el.className = 'rock'; el.innerHTML = `<span>${v}</span><small>${i + 1}</small>`;
      const size = 64 + Math.random() * 26; el.style.width = el.style.height = size + 'px';
      const x = slot * i + (slot - size) / 2 + (Math.random() - .5) * Math.min(30, slot - size);
      el.style.left = Math.max(0, Math.min(W - size, x)) + 'px'; el.style.setProperty('--spin', (Math.random() * 60 - 30) + 'deg');
      this.rocksEl.appendChild(el);
      this.rocks.push({ el, v, y: -size - Math.random() * 40, size, speed: 1 + Math.random() * .2 });
    });
    this.updateHud();
  }
  loop(t) {
    if (!this.alive) return;
    const dt = Math.min(40, this.last ? t - this.last : 16); this.last = t;
    const H = this.rocksEl.clientHeight || 400, bottom = H - 90;
    if (!this.busy) for (const r of this.rocks) {
      r.y += (H / this.fall) * dt * r.speed; r.el.style.transform = `translateY(${r.y}px) rotate(calc(var(--spin) * ${(r.y / 60).toFixed(2)}))`;
      if (r.y + r.size > bottom) { this.miss('Too slow! The asteroid got through.'); break; }
    }
    requestAnimationFrame(this.loop);
  }
  hit(rock) {
    if (this.busy || !rock) return;
    const ms = performance.now() - this.t0, correct = rock.v === this.q.ans;
    this.busy = true;
    const laser = this.root.querySelector('#laser'), rr = rock.el.getBoundingClientRect(), fr = this.field.getBoundingClientRect();
    laser.style.cssText = `display:block;left:${rr.left - fr.left + rr.width / 2}px;height:${fr.bottom - 80 - rr.top - rr.height / 2}px;top:${rr.top - fr.top + rr.height / 2}px`;
    setTimeout(() => laser.style.display = 'none', 120);
    if (correct) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const r = this.sess.answer(this.q, true, ms, this.combo); this.stars += r.stars;
      this.results.push({ fact: this.q.fact, correct: true, ms });
      burst(rr.left + rr.width / 2, rr.top + rr.height / 2); sound.correct(this.combo); if (r.fast) sound.fast();
      if (this.combo % 5 === 0) { sound.combo(); confetti({ count: 50 }); }
      rock.el.classList.add('boom'); this.rocks.filter(x => x !== rock).forEach(x => x.el.classList.add('fade'));
      this.index++; this.updateHud(); setTimeout(() => this.nextQ(), 450);
    } else {
      rock.el.classList.add('crack'); this.miss(`Not that one — ${this.q.text} = ${this.q.ans}`);
    }
  }
  miss(msg) {
    if (!this.alive) return;
    this.busy = true; this.combo = 0; this.shields--;
    this.sess.answer(this.q, false, performance.now() - this.t0, 0);
    this.results.push({ fact: this.q.fact, correct: false, ms: performance.now() - this.t0 });
    sound.wrong(); try { navigator.vibrate?.([60, 40, 60]); } catch {}
    const f = this.root.querySelector('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    const ok = this.rocks.find(r => r.v === this.q.ans); ok?.el.classList.add('reveal');
    this.root.querySelector('#ab-q').innerHTML = `<span class="bad">${msg}</span>`;
    this.index++; this.updateHud(); setTimeout(() => this.nextQ(), 1600);
  }
  end() { this.destroy(); this.onEnd({ results: this.results, stars: this.stars, maxCombo: this.maxCombo, survived: this.shields > 0, op: this.op }); }
  destroy() { this.alive = false; removeEventListener('keydown', this.keys); }
}
