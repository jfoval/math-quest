// Star Base: a voxel plot the kid builds up by spending stars. Items are lists of cubes at fixed slots.
import { at, render, figure, proj, S } from './voxel.js';

const G = '#8b93a7', G2 = '#7c8499';
export const N = 12;
function ground(n = N) { const c = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) c.push(at(x, y, -0.4, (x + y) % 2 ? G : G2, 1, 1, 0.4)); return c; }

// Each item: slot origin (x,y), price, name, blurb, build(): cubes relative to origin, optional anim class.
export const ITEMS = {
  flag:     { name: 'Flag', price: 80, blurb: 'Claim your base', x: 7, y: 1, build: (a) => [at(0.4, 0.4, 0, '#cbd5e1', 0.2, 0.2, 3), at(0.6, 0.4, 2.2, a.shirt || '#ef4444', 1, 0.1, 0.8, '')] , anim: 'wave' },
  pad:      { name: 'Landing pad', price: 100, blurb: 'Somewhere to park', x: 4, y: 5, build: () => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.push(at(i, j, 0, (i + j) % 2 ? '#334155' : '#475569', 1, 1, 0.15)); [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([i, j]) => c.push(at(i + 0.4, j + 0.4, 0.15, '#fde047', 0.2, 0.2, 0.15))); return c; }, anim: 'blink' },
  solar:    { name: 'Solar array', price: 150, blurb: 'Power for the lights', x: 0, y: 6, build: () => { const c = []; for (let i = 0; i < 3; i++) c.push(at(i, 0.4, 0, '#94a3b8', 0.2, 0.2, 0.8), at(i - 0.1, 0, 0.8, '#2563eb', 1, 1, 0.15)); return c; } },
  antenna:  { name: 'Antenna tower', price: 180, blurb: 'Calls home', x: 1, y: 1, build: () => [at(0, 0, 0, '#64748b', 1, 1, 0.4), at(0.35, 0.35, 0.4, '#94a3b8', 0.3, 0.3, 4.5), at(0.1, 0.1, 3.2, '#94a3b8', 0.8, 0.8, 0.15), at(0.3, 0.3, 4.9, '#ef4444', 0.4, 0.4, 0.4)], anim: 'blink' },
  garden:   { name: 'Space garden', price: 200, blurb: 'Fresh space-strawberries', x: 0, y: 3, build: () => { const c = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.push(at(i, j, 0, '#78350f', 1, 1, 0.3)); c.push(at(i + 0.3, j + 0.3, 0.3, '#22c55e', 0.4, 0.4, 0.6 + ((i + j) % 2) * 0.4)); c.push(at(i + 0.35, j + 0.35, 0.9 + ((i + j) % 2) * 0.4, '#ec4899', 0.3, 0.3, 0.3)); } return c; } },
  dome:     { name: 'Habitat dome', price: 300, blurb: 'Home sweet dome', x: 3, y: 1, build: () => [at(0, 0, 0, '#e2e8f0', 3, 3, 1.2), at(0.5, 0.5, 1.2, '#cbd5e1', 2, 2, 0.9), at(1, 1, 2.1, '#bae6fd', 1, 1, 0.6), at(1, 3, 0, '#93c5fd', 1, 0.05, 0.9), at(3, 1, 0, '#93c5fd', 0.05, 1, 0.9)] },
  tanks:    { name: 'Fuel tanks', price: 220, blurb: 'Rocket juice', x: 6, y: 3, build: () => [at(0, 0, 0, '#f97316', 0.9, 0.9, 1.6), at(1.1, 0, 0, '#f97316', 0.9, 0.9, 1.6), at(0.2, 0.2, 1.6, '#fb923c', 0.5, 0.5, 0.3), at(1.3, 0.2, 1.6, '#fb923c', 0.5, 0.5, 0.3)] },
  rover:    { name: 'Rover', price: 320, blurb: 'It drives around!', x: 2, y: 7, build: () => [at(0, 0.2, 0.3, '#f8fafc', 1.4, 0.8, 0.5), at(0.2, 0.3, 0.8, '#38bdf8', 0.6, 0.6, 0.4), at(0, 0, 0, '#1f2937', 0.4, 0.3, 0.35), at(1, 0, 0, '#1f2937', 0.4, 0.3, 0.35), at(0, 0.9, 0, '#1f2937', 0.4, 0.3, 0.35), at(1, 0.9, 0, '#1f2937', 0.4, 0.3, 0.35)], anim: 'drive' },
  crystals: { name: 'Alien crystals', price: 350, blurb: 'They glow at night', x: 7, y: 7, build: () => [at(0, 0, 0, '#a855f7', 0.5, 0.5, 1.8), at(0.6, 0.2, 0, '#c084fc', 0.4, 0.4, 1.2), at(0.2, 0.7, 0, '#d8b4fe', 0.4, 0.4, 0.9), at(0.9, 0.8, 0, '#a855f7', 0.3, 0.3, 0.6)], anim: 'glow' },
  telescope:{ name: 'Telescope', price: 380, blurb: 'See Planet Plus from here', x: 5, y: 0, build: () => [at(0, 0, 0, '#475569', 1.2, 1.2, 0.4), at(0.35, 0.35, 0.4, '#64748b', 0.5, 0.5, 1.4), at(0.1, 0.3, 1.8, '#f8fafc', 1.4, 0.6, 0.6), at(1.5, 0.4, 2.1, '#1e293b', 0.3, 0.4, 0.4)] },
  dish:     { name: 'Satellite dish', price: 420, blurb: 'Pings the mothership', x: 0, y: 0, build: () => [at(0, 0, 0, '#64748b', 1, 1, 0.4), at(0.4, 0.4, 0.4, '#94a3b8', 0.2, 0.2, 1.2), at(-0.3, -0.3, 1.6, '#e2e8f0', 1.6, 1.6, 0.2), at(0.4, 0.4, 1.8, '#94a3b8', 0.2, 0.2, 0.6), at(0.3, 0.3, 2.4, '#ef4444', 0.4, 0.4, 0.3)] },
  lights:   { name: 'Party lights', price: 260, blurb: 'Base disco', x: 0, y: 8, build: () => { const cs = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ec4899']; const c = []; for (let i = 0; i < 9; i++) c.push(at(i + 0.35, 0.35, 1.1, cs[i % 5], 0.3, 0.3, 0.3)); c.push(at(0, 0.45, 1.2, '#1f2937', 9, 0.08, 0.08)); c.push(at(0.4, 0.4, 0, '#1f2937', 0.15, 0.15, 1.1), at(8.4, 0.4, 0, '#1f2937', 0.15, 0.15, 1.1)); return c; }, anim: 'blink' },
  pet:      { name: 'Pet bot', price: 450, blurb: 'Beep boop, it follows you', x: 2, y: 4, build: () => [at(0, 0, 0.2, '#e2e8f0', 0.8, 0.8, 0.7), at(0.1, 0.1, 0.9, '#38bdf8', 0.6, 0.6, 0.5), at(0.35, 0.35, 1.4, '#fde047', 0.1, 0.1, 0.5), at(0.2, -0.05, 1.0, '#0b1026', 0.15, 0.05, 0.15), at(0.5, -0.05, 1.0, '#0b1026', 0.15, 0.05, 0.15)], anim: 'hop' },
  tower:    { name: 'Lookout tower', price: 520, blurb: 'Tallest thing on the moon', x: 7, y: 4, build: () => [at(0, 0, 0, '#64748b', 1.2, 1.2, 0.4), at(0.3, 0.3, 0.4, '#94a3b8', 0.6, 0.6, 3.6), at(-0.2, -0.2, 4, '#e2e8f0', 1.6, 1.6, 0.9), at(0.2, 0.2, 4.9, '#bae6fd', 0.8, 0.8, 0.6)] },
  bench:    { name: 'Park bench', price: 130, blurb: 'A spot to sit', x: 8, y: 2, build: () => [at(0, 0.3, 0.5, '#b45309', 1.6, 0.5, 0.15), at(0, 0.75, 0.5, '#b45309', 1.6, 0.1, 0.6), at(0.1, 0.35, 0, '#1f2937', 0.15, 0.4, 0.5), at(1.35, 0.35, 0, '#1f2937', 0.15, 0.4, 0.5)] },
  trampoline: { name: 'Trampoline', price: 170, blurb: 'Boing!', x: 9, y: 9, build: () => [at(0, 0, 0.5, '#1f2937', 1.6, 1.6, 0.15), at(0.2, 0.2, 0.55, '#0ea5e9', 1.2, 1.2, 0.1), at(0, 0, 0, '#475569', 0.15, 0.15, 0.5), at(1.45, 0, 0, '#475569', 0.15, 0.15, 0.5), at(0, 1.45, 0, '#475569', 0.15, 0.15, 0.5), at(1.45, 1.45, 0, '#475569', 0.15, 0.15, 0.5)], anim: 'hop' },
  greenhouse: { name: 'Greenhouse', price: 380, blurb: 'Space veggies all year', x: 0, y: 6, build: () => [at(0, 0, 0, '#6b4f2a', 2.2, 1.6, 0.2), at(0.3, 0.3, 0.2, '#22c55e', 0.5, 0.5, 0.5), at(1.3, 0.3, 0.2, '#22c55e', 0.5, 0.5, 0.7), at(0.8, 0.9, 0.2, '#ec4899', 0.4, 0.4, 0.6), at(0, 0, 0.2, '#bae6fd', 0.08, 1.6, 1.4), at(2.12, 0, 0.2, '#bae6fd', 0.08, 1.6, 1.4), at(0, 0, 1.6, '#bae6fd', 2.2, 1.6, 0.08)] },
  ufo:      { name: 'Crashed UFO', price: 600, blurb: 'It was like this when we got here', x: 7.5, y: 4, build: () => [at(0, 0, 0.2, '#94a3b8', 2.4, 2.4, 0.35), at(0.6, 0.6, 0.55, '#bae6fd', 1.2, 1.2, 0.7), at(-0.3, 1, 0, '#475569', 0.5, 0.4, 0.2), at(2.2, 1, 0, '#475569', 0.5, 0.4, 0.2), at(0.2, 0.2, 0.25, '#facc15', 0.25, 0.25, 0.15), at(1.95, 1.95, 0.25, '#facc15', 0.25, 0.25, 0.15)], anim: 'blink' },
  statue:   { name: 'Statue of you', price: 700, blurb: 'Gold. Obviously.', x: 5.5, y: 3, build: (a) => [at(0, 0, 0, '#475569', 1.6, 1.6, 0.6), ...statueOf(a)] },
  elevator: { name: 'Space elevator', price: 900, blurb: 'Goes all the way up', x: 11, y: 0, build: () => [at(0, 0, 0, '#334155', 1, 1, 0.5), at(0.4, 0.4, 0.5, '#e2e8f0', 0.2, 0.2, 7), at(0.1, 0.1, 4, '#38bdf8', 0.8, 0.8, 0.6), at(0.25, 0.25, 7.5, '#fde047', 0.5, 0.5, 0.3)], anim: 'blink' },
  rocket:   { name: 'Rocket silo', price: 800, blurb: 'Your very own rocket', x: 4.5, y: 5.5, build: () => [at(0, 0, 0, '#334155', 2, 2, 0.3), at(0.5, 0.5, 0.3, '#f8fafc', 1, 1, 3), at(0.65, 0.65, 3.3, '#f8fafc', 0.7, 0.7, 0.8), at(0.8, 0.8, 4.1, '#ef4444', 0.4, 0.4, 0.7), at(0.2, 0.2, 0.3, '#ef4444', 0.3, 0.3, 1), at(1.5, 0.2, 0.3, '#ef4444', 0.3, 0.3, 1), at(0.2, 1.5, 0.3, '#ef4444', 0.3, 0.3, 1), at(0.8, 1, 2, '#38bdf8', 0.4, 0.05, 0.4)] },
};
export const ITEM_ORDER = Object.keys(ITEMS).sort((a, b) => ITEMS[a].price - ITEMS[b].price);

// --- default slot positions on the 12×12 plot ---
const DEFAULT_POS = { bench: [8, 2], trampoline: [9, 9], greenhouse: [0, 6], ufo: [7.5, 4], statue: [5.5, 3], elevator: [11, 0], flag: [10, 1], pad: [6, 7], solar: [0, 9], antenna: [1, 1], garden: [0, 4], dome: [4, 1], tanks: [9, 4], rover: [3, 10], crystals: [7.5, 11], telescope: [7, 0], dish: [0, 0], lights: [1, 11], pet: [3, 5], tower: [10, 6], rocket: [6.5, 7.5], me: [11, 7] };
// a golden voxel copy of the kid's avatar, shrunk onto a plinth
function statueOf(a) { const gold = '#facc15'; const f = [at(0.35, 0.35, 0.6, gold, 0.4, 0.4, 0.8), at(0.85, 0.35, 0.6, gold, 0.4, 0.4, 0.8), at(0.35, 0.35, 1.4, gold, 0.9, 0.4, 0.8), at(-0.05, 0.35, 1.4, gold, 0.4, 0.4, 0.8), at(1.25, 0.35, 1.4, gold, 0.4, 0.4, 0.8), at(0.35, 0.35, 2.2, gold, 0.9, 0.4, 0.9)]; if (a?.hat && a.hat !== 'none') f.push(at(0.3, 0.3, 3.1, gold, 1, 0.5, 0.3)); return f; }
function footprint(cs) { return { w: Math.max(...cs.map(c => c.x + c.w)), d: Math.max(...cs.map(c => c.y + c.d)) }; }
export function itemPos(kid, key) { const p = kid.base?.pos?.[key]; return p ? [p.x, p.y] : DEFAULT_POS[key] || [ITEMS[key]?.x || 0, ITEMS[key]?.y || 0]; }

export function baseScene(kid, { width = 360, height = 330 } = {}) {
  const owned = kid.base?.items || [];
  const cubes = ground();
  const groups = [];
  for (const key of owned) {
    const it = ITEMS[key]; if (!it) continue;
    const cs = it.build(kid.avatarCfg || {}).map(c => ({ ...c, x: c.x + it.x, y: c.y + it.y }));
    if (it.anim) groups.push({ key, cs, anim: it.anim }); else cubes.push(...cs);
  }
  // static cubes rendered together; animated items as separate groups positioned with their own transform
  let extra = '';
  for (const g of groups) {
    const sorted = [...g.cs].sort((a, b) => (a.x + a.w + a.y + a.d) - (b.x + b.w + b.y + b.d) || a.z - b.z);
    extra += `<g class="anim-${g.anim}">${sorted.map(c => cubeHTML(c)).join('')}</g>`;
  }
  // avatar figure standing at front-center of the plot
  const [fx, fy] = proj(8.4, 8.6, 0);
  extra += `<g transform="translate(${fx},${fy}) scale(0.55) translate(-10,-42)">${figureInline(kid)}</g>`;
  // plot spans x −156…156 and y 0…180 (plus ~130px of headroom for tall builds)
  return render(cubes, { width, height, cx: 0.5, cy: 0.42, extra });
}
import { cube } from './voxel.js';
function cubeHTML(c) { return cube(c.x, c.y, c.z, c.color, c.w, c.d, c.h); }
function figureInline(kid) { // strip the outer svg and reuse the figure's inner markup
  const svg = figure(kid.avatarCfg || {}, { size: 120 });
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return inner;
}
export function itemPreview(key, kid) {
  const it = ITEMS[key]; const cs = it.build(kid.avatarCfg || {});
  const maxz = Math.max(...cs.map(c => c.z + c.h)), maxx = Math.max(...cs.map(c => c.x + c.w)), maxy = Math.max(...cs.map(c => c.y + c.d));
  const w = (maxx + maxy) * 0.9 * S + 20, h = maxz * S + (maxx + maxy) * 0.5 * S + 20;
  const k = Math.min(1, 84 / Math.max(w, h));
  return render(cs, { width: w, height: h, scale: k, cx: maxy * 0.866 * S / w + 0.08, cy: (maxz * S + 10) / h });
}


// ---------- Interactive base: pan / zoom / drag items ----------
const VB = { w: 470, h: 400 };
export function mountBase(container, kid, { onChange } = {}) {
  kid.base ||= { items: [] }; kid.base.pos ||= {};
  const cam = kid.base.cam || { x: 0, y: 0, k: 1 };
  const sx = (x, y) => proj(x, y, 0);
  let svg = null;
  const groups = () => {
    const out = [];
    for (const key of kid.base.items) { const it = ITEMS[key]; if (!it) continue; const [ox, oy] = itemPos(kid, key); const cs = it.build(kid.avatarCfg || {}); out.push({ key, ox, oy, cs, fp: footprint(cs), anim: it.anim }); }
    const [mx, my] = itemPos(kid, 'me'); out.push({ key: 'me', ox: mx, oy: my, cs: [], fp: { w: 1.2, d: 1.2 }, me: true });
    // painter's order by origin depth; taller/smaller things placed on top of flat ones draw later
    return out.sort((a, b) => (a.ox + a.oy) - (b.ox + b.oy) || (a.fp.w * a.fp.d) - (b.fp.w * b.fp.d));
  };
  const draw = () => {
    const g = groups();
    const body = g.map(it => {
      const [px, py] = sx(it.ox, it.oy);
      if (it.me) return `<g class="bitem me" data-key="me" transform="translate(${px},${py})"><g transform="scale(0.62) translate(-10,-42)">${figure(kid.avatarCfg || {}, { size: 120 }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g></g>`;
      const sorted = [...it.cs].sort((a, b) => (a.x + a.w + a.y + a.d) - (b.x + b.w + b.y + b.d) || a.z - b.z);
      return `<g class="bitem" data-key="${it.key}" transform="translate(${px},${py})"><g class="${it.anim ? 'anim-' + it.anim : ''}">${sorted.map(c => cube(c.x, c.y, c.z, c.color, c.w, c.d, c.h)).join('')}</g></g>`;
    }).join('');
    const ground_ = ground().map(c => cube(c.x, c.y, c.z, c.color, c.w, c.d, c.h)).join('');
    container.innerHTML = `<svg class="voxel basesvg" viewBox="${-VB.w / 2} ${-VB.h * 0.33} ${VB.w} ${VB.h}" width="100%" height="100%"><g id="cam" transform="translate(${cam.x},${cam.y}) scale(${cam.k})"><g class="ground">${ground_}</g>${body}</g></svg>`;
    svg = container.querySelector('svg');
  };
  draw();

  // --- input handling ---
  const ptrs = new Map(); let mode = null, dragKey = null, start = null, pinch0 = null;
  const toVB = (cx, cy) => { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  const unit = () => 1 / svg.getScreenCTM().a; // viewBox units per screen px
  const invIso = (dx, dy) => { const a = dy / (0.5 * S), b = dx / (0.866 * S); return [(a + b) / 2, (a - b) / 2]; };
  const applyCam = () => { svg.querySelector('#cam').setAttribute('transform', `translate(${cam.x},${cam.y}) scale(${cam.k})`); };
  const clampPos = (key, x, y) => { const it = groups().find(g => g.key === key); const w = it?.fp.w || 1, d = it?.fp.d || 1; return [Math.max(0, Math.min(N - w, Math.round(x * 2) / 2)), Math.max(0, Math.min(N - d, Math.round(y * 2) / 2))]; };
  container.addEventListener('pointerdown', e => {
    e.preventDefault(); try { container.setPointerCapture(e.pointerId); } catch {}
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { mode = 'pinch'; const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cx: cam.x, cy: cam.y }; return; }
    const item = e.target.closest('.bitem');
    if (item) { mode = 'drag'; dragKey = item.dataset.key; const [ox, oy] = itemPos(kid, dragKey); start = { vb: toVB(e.clientX, e.clientY), ox, oy, el: item }; item.classList.add('dragging'); }
    else { mode = 'pan'; start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; }
  });
  container.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (mode === 'pinch' && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.k = Math.max(0.5, Math.min(2.5, pinch0.k * d / pinch0.d)); const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const kk = unit(); cam.x = pinch0.cx + (mid[0] - pinch0.mid[0]) * kk; cam.y = pinch0.cy + (mid[1] - pinch0.mid[1]) * kk; applyCam(); return; }
    if (mode === 'pan') { const k = unit(); cam.x = start.cx + (e.clientX - start.x) * k; cam.y = start.cy + (e.clientY - start.y) * k; applyCam(); return; }
    if (mode === 'drag') { const v = toVB(e.clientX, e.clientY); const [gx, gy] = invIso((v[0] - start.vb[0]) / cam.k, (v[1] - start.vb[1]) / cam.k); const [nx, ny] = clampPos(dragKey, start.ox + gx, start.oy + gy); const [px, py] = sx(nx, ny); start.el.setAttribute('transform', `translate(${px},${py})`); start.nx = nx; start.ny = ny; }
  });
  const end = e => {
    ptrs.delete(e.pointerId);
    if (mode === 'drag' && start) { if (start.nx != null && (start.nx !== start.ox || start.ny !== start.oy)) { kid.base.pos[dragKey] = { x: start.nx, y: start.ny }; onChange?.('move'); } start.el.classList.remove('dragging'); draw(); }
    if (mode === 'pan' || mode === 'pinch') { kid.base.cam = { ...cam }; onChange?.('cam'); }
    if (ptrs.size === 0) { mode = null; start = null; }
    else if (ptrs.size === 1 && mode === 'pinch') { mode = 'pan'; const [p] = [...ptrs.values()]; start = { x: p[0], y: p[1], cx: cam.x, cy: cam.y }; }
  };
  container.addEventListener('pointerup', end); container.addEventListener('pointercancel', end);
  // Some in-app browsers ignore touch-action; explicitly swallow touch scrolling while a finger is on the scene.
  for (const t of ['touchstart', 'touchmove']) container.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  container.addEventListener('wheel', e => { e.preventDefault(); cam.k = Math.max(0.5, Math.min(2.5, cam.k * (e.deltaY < 0 ? 1.1 : 0.9))); applyCam(); kid.base.cam = { ...cam }; }, { passive: false });
  return { redraw: draw, reset() { cam.x = 0; cam.y = 0; cam.k = 1; kid.base.cam = { ...cam }; kid.base.pos = {}; onChange?.('reset'); draw(); } };
}
