const canvas = document.getElementById('confetti');
const ctx = canvas.getContext('2d');
let parts = [], raf = null;
function size() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
addEventListener('resize', size); size();
const COLORS = ['#fde047', '#38bdf8', '#f472b6', '#34d399', '#fb923c', '#a78bfa', '#fff'];
export function confetti({ count = 120, x = innerWidth / 2, y = innerHeight / 3, spread = 1 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) count = Math.min(count, 30);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9 * spread;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, g: 0.25 + Math.random() * 0.1, s: 5 + Math.random() * 7,
      c: COLORS[i % COLORS.length], r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 70 + Math.random() * 50 });
  }
  if (!raf) loop();
}
export function clearConfetti() { parts = []; ctx.clearRect(0, 0, innerWidth, innerHeight); }
export function burst(x, y) { confetti({ count: 28, x, y, spread: 0.6 }); }
function loop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99; p.r += p.vr; p.life--;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : (ctx.clearRect(0, 0, innerWidth, innerHeight), null);
}
