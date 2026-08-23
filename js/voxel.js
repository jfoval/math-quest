// Tiny isometric voxel renderer (SVG). A cube at grid (x, y, z) draws three shaded faces.
// Used for the blocky avatar and the Star Base.
const S = 20;                     // cube size in px
const ISO = { x: [0.866, 0.5], y: [-0.866, 0.5] };  // axis vectors
function proj(x, y, z) { return [x * ISO.x[0] * S + y * ISO.y[0] * S, x * ISO.x[1] * S + y * ISO.y[1] * S - z * S]; }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)), g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)), b = Math.min(255, Math.max(0, (n & 255) * k)); return `rgb(${r | 0},${g | 0},${b | 0})`; }

// cube occupying [x,x+w) × [y,y+d) × [z,z+h)
export function cube(x, y, z, color, w = 1, d = 1, h = 1) {
  const p = (a, b, c) => proj(a, b, c).join(',');
  const top = [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)].join(' ');
  const right = [p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)].join(' ');
  const left = [p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)].join(' ');
  return `<polygon points="${top}" fill="${shade(color, 1.15)}"/><polygon points="${right}" fill="${shade(color, 0.8)}"/><polygon points="${left}" fill="${shade(color, 0.6)}"/>`;
}
// Sort key so nearer cubes draw last (painter's algorithm).
export const depth = c => c.x + c.y + c.z * 0.001;
export function render(cubes, { width = 320, height = 240, scale = 1, cx = 0.5, cy = 0.55, extra = '' } = {}) {
  const sorted = [...cubes].sort((a, b) => (a.x + a.w + a.y + a.d) - (b.x + b.w + b.y + b.d) || a.z - b.z);
  const body = sorted.map(c => cube(c.x, c.y, c.z, c.color, c.w, c.d, c.h) + (c.deco || '')).join('');
  return `<svg class="voxel" viewBox="${-width * cx} ${-height * cy} ${width} ${height}" width="${width * scale}" height="${height * scale}" aria-hidden="true"><g>${body}</g>${extra}</svg>`;
}
export function at(x, y, z, color, w = 1, d = 1, h = 1, deco = '') { return { x, y, z, color, w, d, h, deco }; }
export { proj, S };

// ---------- Blocky avatar ----------
export const SKINS = ['#f5c9a6', '#e0ac7e', '#c68642', '#8d5524', '#ffdbac', '#a3e635', '#60a5fa', '#c084fc'];
export const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1f2937'];
export const HATS = {
  none: { name: 'No hat', price: 0 },
  cap: { name: 'Cap', price: 60 }, beanie: { name: 'Beanie', price: 60 }, crown: { name: 'Crown', price: 250 }, helmet: { name: 'Space helmet', price: 180 },
  wizard: { name: 'Wizard hat', price: 200 }, headphones: { name: 'Headphones', price: 120 }, halo: { name: 'Halo', price: 300 }, tophat: { name: 'Top hat', price: 150 }, antenna: { name: 'Antenna', price: 90 }, horns: { name: 'Horns', price: 220 },
};
export const FACES = {
  smile: { name: 'Smile', price: 0 }, cool: { name: 'Cool shades', price: 120 }, wink: { name: 'Wink', price: 50 }, robot: { name: 'Robot', price: 150 }, cat: { name: 'Cat', price: 150 }, grin: { name: 'Big grin', price: 50 }, sleepy: { name: 'Sleepy', price: 40 }, star: { name: 'Star eyes', price: 200 },
};
export const DEFAULT_AVATAR = { skin: '#f5c9a6', shirt: '#3b82f6', pants: '#1f2937', hat: 'none', hatColor: '#ef4444', face: 'smile' };

export function figure(cfg = DEFAULT_AVATAR, { size = 96, pose = 'stand' } = {}) {
  const a = { ...DEFAULT_AVATAR, ...cfg }, c = [];
  // legs, body, arms, head — unit voxels
  c.push(at(0, 0, 0, a.pants, 1, 1, 2), at(1, 0, 0, a.pants, 1, 1, 2));
  c.push(at(0, 0, 2, a.shirt, 2, 1, 2));
  c.push(at(-1, 0, 2, a.skin, 1, 1, 2), at(2, 0, 2, a.skin, 1, 1, 2));
  c.push(at(0, 0, 4, a.skin, 2, 1, 2));
  const hatC = a.hatColor;
  if (a.hat === 'cap') c.push(at(0, 0, 6, hatC, 2, 1, 0.5), at(0, -0.8, 6, hatC, 2, 0.8, 0.25));
  if (a.hat === 'beanie') c.push(at(0, 0, 6, hatC, 2, 1, 0.8), at(0.5, 0.25, 6.8, hatC, 1, 0.5, 0.5));
  if (a.hat === 'crown') c.push(at(0, 0, 6, '#facc15', 2, 1, 0.4), at(0, 0, 6.4, '#facc15', 0.5, 1, 0.6), at(0.75, 0, 6.4, '#facc15', 0.5, 1, 0.8), at(1.5, 0, 6.4, '#facc15', 0.5, 1, 0.6));
  if (a.hat === 'helmet') c.push(at(-0.3, -0.3, 3.8, '#dbeafe', 2.6, 1.6, 2.6));
  if (a.hat === 'wizard') c.push(at(0, 0, 6, hatC, 2, 1, 0.3), at(0.4, 0.2, 6.3, hatC, 1.2, 0.6, 1), at(0.7, 0.35, 7.3, hatC, 0.6, 0.3, 1));
  if (a.hat === 'headphones') c.push(at(-0.3, 0.2, 4.5, '#1f2937', 0.3, 0.6, 1), at(2, 0.2, 4.5, '#1f2937', 0.3, 0.6, 1), at(0, 0.3, 6, '#1f2937', 2, 0.4, 0.3));
  if (a.hat === 'halo') c.push(at(-0.2, -0.2, 6.6, '#fde047', 2.4, 1.4, 0.2));
  if (a.hat === 'tophat') c.push(at(-0.3, -0.3, 6, '#1f2937', 2.6, 1.6, 0.2), at(0.2, 0.1, 6.2, '#1f2937', 1.6, 0.8, 1.4));
  if (a.hat === 'antenna') c.push(at(0.9, 0.4, 6, '#94a3b8', 0.2, 0.2, 1), at(0.75, 0.25, 7, '#fde047', 0.5, 0.5, 0.5));
  if (a.hat === 'horns') c.push(at(-0.2, 0.3, 5.6, hatC, 0.4, 0.4, 1), at(1.8, 0.3, 5.6, hatC, 0.4, 0.4, 1));
  // face drawn on the wide front face of the head (the y = 1 plane), skewed to match the isometric angle
  const [px, py] = proj(0, 1, 6);
  const faces = {
    smile: `<circle cx="6" cy="6" r="1.8" fill="#0b1026"/><circle cx="14" cy="6" r="1.8" fill="#0b1026"/><path d="M6 12 q4 4 8 0" stroke="#0b1026" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    grin: `<circle cx="6" cy="6" r="1.8" fill="#0b1026"/><circle cx="14" cy="6" r="1.8" fill="#0b1026"/><path d="M5 11 q5 7 10 0 z" fill="#0b1026"/><path d="M7 11.5 h6" stroke="#fff" stroke-width="1.2"/>`,
    wink: `<path d="M4 6 l4 0" stroke="#0b1026" stroke-width="1.8" stroke-linecap="round"/><circle cx="14" cy="6" r="1.8" fill="#0b1026"/><path d="M6 12 q4 4 8 0" stroke="#0b1026" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    cool: `<rect x="3" y="4" width="6" height="4" rx="1" fill="#0b1026"/><rect x="11" y="4" width="6" height="4" rx="1" fill="#0b1026"/><path d="M9 5.5 h2" stroke="#0b1026" stroke-width="1.5"/><path d="M6 12 q4 4 8 0" stroke="#0b1026" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    robot: `<rect x="4" y="4" width="4" height="4" fill="#22d3ee"/><rect x="12" y="4" width="4" height="4" fill="#22d3ee"/><path d="M5 13 h10" stroke="#0b1026" stroke-width="2"/><path d="M7 11 v4 M10 11 v4 M13 11 v4" stroke="#0b1026" stroke-width="1"/>`,
    cat: `<path d="M4 7 l2 -3 l2 3 z M12 7 l2 -3 l2 3 z" fill="#0b1026"/><circle cx="10" cy="11" r="1.2" fill="#ec4899"/><path d="M7 13 q3 2 3 0 q0 2 3 0" stroke="#0b1026" stroke-width="1.2" fill="none"/><path d="M1 10 h5 M14 10 h5" stroke="#0b1026" stroke-width=".8"/>`,
    sleepy: `<path d="M4 6 l4 0 M12 6 l4 0" stroke="#0b1026" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12" r="1.4" fill="#0b1026"/>`,
    star: `<text x="6" y="8.5" font-size="7" fill="#fde047" text-anchor="middle" font-weight="900">★</text><text x="14" y="8.5" font-size="7" fill="#fde047" text-anchor="middle" font-weight="900">★</text><path d="M6 12 q4 4 8 0" stroke="#0b1026" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  };
  // local face coords: 0..20 across (u), 0..20 down (v); map u→ISO x axis, v→down
  const face = `<g transform="matrix(${ISO.x[0] * 2 * S / 20},${ISO.x[1] * 2 * S / 20},0,${2 * S / 20},${px},${py}) translate(0,1)">${faces[a.face] || faces.smile}</g>`;
  return render(c, { width: 120, height: 225, scale: size / 120, cx: 0.42, cy: 0.79, extra: face });
}
