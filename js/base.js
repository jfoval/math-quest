// Star Base: a voxel plot the kid builds up by spending stars. Items are lists of cubes at fixed slots.
import { at, render, figure, proj, S } from './voxel.js';

const G = '#8b93a7', G2 = '#7c8499';
function ground(n = 9) { const c = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) c.push(at(x, y, -0.4, (x + y) % 2 ? G : G2, 1, 1, 0.4)); return c; }

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
  rocket:   { name: 'Rocket silo', price: 800, blurb: 'Your very own rocket', x: 4.5, y: 5.5, build: () => [at(0, 0, 0, '#334155', 2, 2, 0.3), at(0.5, 0.5, 0.3, '#f8fafc', 1, 1, 3), at(0.65, 0.65, 3.3, '#f8fafc', 0.7, 0.7, 0.8), at(0.8, 0.8, 4.1, '#ef4444', 0.4, 0.4, 0.7), at(0.2, 0.2, 0.3, '#ef4444', 0.3, 0.3, 1), at(1.5, 0.2, 0.3, '#ef4444', 0.3, 0.3, 1), at(0.2, 1.5, 0.3, '#ef4444', 0.3, 0.3, 1), at(0.8, 1, 2, '#38bdf8', 0.4, 0.05, 0.4)] },
};
export const ITEM_ORDER = Object.keys(ITEMS).sort((a, b) => ITEMS[a].price - ITEMS[b].price);

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
