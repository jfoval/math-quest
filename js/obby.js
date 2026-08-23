// Math Obby: hop your blocky avatar across floating platforms. Each jump = pick the platform with the right answer.
import { Session, speedLimit } from './engine.js';
import { OPS } from './facts.js';
import { sound } from './sound.js';
import { burst, confetti } from './confetti.js';
import { figure, render, at } from './voxel.js';
import { distractors } from './asteroids.js';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
function slab(color, w = 3) { return render([at(0, 0, 0, color, w, 1.2, 0.7)], { width: w * 36 + 20, height: 60, cx: 0.3, cy: 0.35 }); }

export class Obby {
  constructor({ kid, op, root, onEnd, speak }) {
    Object.assign(this, { kid, op, root, onEnd, speak });
    this.sess = new Session(kid, op); this.total = 10; this.index = 0; this.results = []; this.stars = 0; this.combo = 0; this.maxCombo = 0; this.falls = 0; this.alive = true;
    this.stepX = 260; this.render(); this.nextQ();
    this.keys = e => { if (/^[1-3]$/.test(e.key)) this.choose(+e.key - 1); };
    addEventListener('keydown', this.keys);
  }
  destroy() { this.alive = false; removeEventListener('keydown', this.keys); }
  render() {
    const o = OPS[this.op];
    this.root.innerHTML = `<header class="topbar play">
      <button class="iconbtn" data-quit title="Quit">✕</button>
      <div class="progress"><div class="dots" id="ob-dots"></div><small>🏃 Math Obby · ${o.planet} · <span id="ob-q"></span></small></div>
      <div class="stars" id="play-stars">⭐ 0</div></header>
      <div class="obby" id="obby">
        <div class="obby-q" id="obby-big"></div>
        <div class="world" id="world"></div>
        <div class="lava"></div>
        <div class="feedback" id="feedback"></div>
      </div>
      <p class="sub hintline">Tap the platform with the right answer<span class="kbd-only"> — or press 1–3</span></p>`;
    this.world = this.root.querySelector('#world');
    this.world.addEventListener('click', e => { const p = e.target.closest('.plat.choice'); if (p) this.choose(+p.dataset.i); });
    // starting platform + avatar
    this.world.innerHTML = `<div class="plat start" style="left:0px;--h:0px">${slab('#64748b', 3)}</div><div class="runner" id="runner" style="left:20px;--h:0px">${figure(this.kid.avatarCfg || {}, { size: 80 })}</div>`;
    this.offset = 0; this.hud();
  }
  hud() {
    this.root.querySelector('#ob-dots').innerHTML = Array.from({ length: this.total }, (_, i) => `<i class="${this.results[i] ? (this.results[i].correct ? 'ok' : 'bad') : ''} ${i === this.index ? 'cur' : ''}"></i>`).join('');
    this.root.querySelector('#play-stars').textContent = `⭐ ${this.stars}`;
  }
  nextQ() {
    if (!this.alive) return;
    if (this.index >= this.total) return this.finishLine();
    this.q = this.sess.next(); this.t0 = performance.now(); this.busy = false;
    this.speak?.(this.q);
    const o = OPS[this.op];
    this.root.querySelector('#obby-big').innerHTML = `${this.q.a} <span style="color:${o.color}">${this.q.sym}</span> ${this.q.b} = ?`;
    this.root.querySelector('#ob-q').textContent = `jump ${this.index + 1} of ${this.total}`;
    const answers = [this.q.ans, ...distractors(this.q.fact, 2)].sort(() => Math.random() - .5);
    const heights = [0, 60, 125].sort(() => Math.random() - .5);
    this.world.querySelectorAll('.plat.choice').forEach(p => p.remove());
    this.choices = answers.map((v, i) => ({ v, h: heights[i], x: this.offset + this.stepX }));
    this.choices.forEach((c, i) => { const d = document.createElement('div'); d.className = 'plat choice'; d.dataset.i = i; d.style.left = c.x + 'px'; d.style.setProperty('--h', c.h + 'px'); d.style.transform = `translate(${(i - 1) * 0}px, 0)`; d.innerHTML = `${slab(COLORS[(this.index + i) % COLORS.length], 2.4)}<b>${c.v}</b><small>${i + 1}</small>`; d.style.zIndex = 3 - i; d.style.marginLeft = (i * 0) + 'px'; this.world.appendChild(d); });
    // stagger the three horizontally a little so they don't stack visually
    this.world.querySelectorAll('.plat.choice').forEach((p, i) => p.style.left = (this.offset + this.stepX + (i - 1) * 85) + 'px');
    this.hud();
  }
  choose(i) {
    if (this.busy || !this.choices[i]) return; this.busy = true;
    const c = this.choices[i], ms = performance.now() - this.t0, correct = c.v === this.q.ans, runner = this.root.querySelector('#runner');
    this.results.push({ fact: this.q.fact, correct, ms });
    const plat = this.world.querySelector(`.plat.choice[data-i="${i}"]`);
    // jump arc to the chosen platform
    runner.classList.add('jump'); sound.whoosh();
    runner.style.left = (parseFloat(plat.style.left) + 20) + 'px'; runner.style.setProperty('--h', c.h + 'px');
    setTimeout(() => {
      runner.classList.remove('jump');
      if (correct) {
        this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
        const r = this.sess.answer(this.q, true, ms, this.combo); this.stars += r.stars;
        const b = plat.getBoundingClientRect(); burst(b.left + b.width / 2, b.top); sound.correct(this.combo); if (r.fast) sound.fast();
        this.root.querySelector('#feedback').innerHTML = `<span class="pop">+${r.stars} ⭐</span>`;
        // scroll world left so the new platform becomes the start
        this.offset = parseFloat(plat.style.left); this.world.style.transform = `translateX(${-this.offset}px)`;
        this.world.querySelectorAll('.plat.choice').forEach(p => { if (p !== plat) p.classList.add('sink'); });
        plat.classList.remove('choice'); plat.classList.add('start'); plat.querySelector('b')?.remove(); plat.querySelector('small')?.remove();
        this.index++; this.hud(); setTimeout(() => this.nextQ(), 650);
      } else {
        this.combo = 0; this.falls++; this.sess.answer(this.q, false, ms, 0);
        plat.classList.add('crumble'); sound.wrong(); try { navigator.vibrate?.([60, 40, 60]); } catch {}
        runner.classList.add('fall');
        const right = this.choices.findIndex(x => x.v === this.q.ans); this.world.querySelector(`.plat.choice[data-i="${right}"]`)?.classList.add('reveal');
        this.root.querySelector('#feedback').innerHTML = `<span class="pop bad">Oof! ${this.q.text} = ${this.q.ans}</span>`;
        setTimeout(() => { // respawn on the start platform, same question's slot counts as a miss; move on
          runner.classList.remove('fall'); runner.style.left = (this.offset + 20) + 'px'; runner.style.setProperty('--h', this.startH + 'px');
          this.index++; this.hud(); setTimeout(() => this.nextQ(), 500);
        }, 1500);
      }
    }, 520);
    if (correct) this.startH = c.h;
  }
  finishLine() {
    const runner = this.root.querySelector('#runner');
    const d = document.createElement('div'); d.className = 'plat start finish'; d.style.left = (this.offset + this.stepX) + 'px'; d.style.setProperty('--h', this.startH + 'px'); d.innerHTML = `${slab('#fde047', 3)}<span class="flag">🏁</span>`; this.world.appendChild(d);
    runner.classList.add('jump'); runner.style.left = (this.offset + this.stepX + 30) + 'px'; sound.whoosh();
    setTimeout(() => { runner.classList.remove('jump'); runner.classList.add('dance'); confetti({ count: 200 }); sound.fanfare(); setTimeout(() => this.end(), 1400); }, 520);
  }
  end() { this.destroy(); this.onEnd({ results: this.results, stars: this.stars + (this.falls === 0 ? 60 : 0), maxCombo: this.maxCombo, op: this.op, kind: 'obby', falls: this.falls, won: this.falls === 0 }); }
}
