// Hand-drawn SVG art: the four planets and the rocket. No images, scales to any size.
let n = 0;
const uid = () => 'g' + (n++);

export function planet(op, size = 96) {
  const id = uid();
  const defs = {
    add: { base: ['#7dd3fc', '#0369a1'], detail: `
      <path d="M14 40 Q50 28 86 44" stroke="rgba(255,255,255,.35)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M10 58 Q50 70 90 56" stroke="rgba(255,255,255,.25)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="82" cy="22" r="7" fill="#e0f2fe"/>` },
    sub: { base: ['#e9d5ff', '#6d28d9'], detail: `
      <circle cx="36" cy="40" r="9" fill="rgba(0,0,0,.18)"/><circle cx="34" cy="38" r="7" fill="rgba(0,0,0,.12)"/>
      <circle cx="62" cy="62" r="6" fill="rgba(0,0,0,.18)"/><circle cx="68" cy="34" r="4" fill="rgba(0,0,0,.16)"/>
      <circle cx="44" cy="70" r="3.5" fill="rgba(0,0,0,.16)"/>` },
    mul: { base: ['#fdba74', '#c2410c'], detail: `
      <path d="M12 52 Q50 40 88 50" stroke="rgba(255,255,255,.22)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M16 66 Q50 58 84 66" stroke="rgba(120,40,0,.25)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="54" rx="60" ry="13" fill="none" stroke="#fde68a" stroke-width="5" opacity=".9" transform="rotate(-12 50 54)"/>` },
    div: { base: ['#6ee7b7', '#065f46'], detail: `
      <path d="M28 30 Q60 20 74 44 Q84 66 56 74 Q34 80 30 58" stroke="rgba(255,255,255,.28)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#a7f3d0" stroke-width="3" opacity=".5" stroke-dasharray="6 10"/>` },
  }[op];
  return `<svg class="planet-art" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="${id}a" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${defs.base[0]}"/><stop offset="1" stop-color="${defs.base[1]}"/></radialGradient>
      <clipPath id="${id}c"><circle cx="50" cy="50" r="40"/></clipPath>
    </defs>
    <circle cx="50" cy="50" r="40" fill="url(#${id}a)"/>
    <g clip-path="url(#${id}c)">${defs.detail}</g>
    ${op === 'mul' ? `<path d="M-10 54 Q50 41 110 50" stroke="#fde68a" stroke-width="5" fill="none" opacity=".9" transform="rotate(-12 50 54)" clip-path="none"/>` : ''}
    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
    <ellipse cx="36" cy="30" rx="12" ry="7" fill="rgba(255,255,255,.35)" transform="rotate(-30 36 30)"/>
  </svg>`;
}

export function rocket(size = 48, flame = 1) {
  return `<svg class="rocket-art" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <g class="flame" style="transform-origin:22px 32px;transform:scaleX(${flame})">
      <path d="M22 24 L2 32 L22 40 Z" fill="#fb923c"/><path d="M22 27 L9 32 L22 37 Z" fill="#fde047"/>
    </g>
    <path d="M22 20 L48 20 Q62 32 48 44 L22 44 Q14 32 22 20 Z" fill="#f1f5ff"/>
    <path d="M22 20 L48 20 Q55 26 56 32 L22 32 Z" fill="#cbd5e1" opacity=".5"/>
    <circle cx="42" cy="32" r="6" fill="#38bdf8" stroke="#0b1026" stroke-width="2"/>
    <path d="M24 20 L16 10 L30 20 Z" fill="#ef4444"/><path d="M24 44 L16 54 L30 44 Z" fill="#ef4444"/>
    <path d="M56 32 L62 32" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

export function asteroid(size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7 L9 2 L15 4 L18 10 L14 17 L7 18 L2 13 Z" fill="#9ca3af"/><circle cx="8" cy="9" r="2" fill="#6b7280"/><circle cx="13" cy="12" r="1.5" fill="#6b7280"/></svg>`;
}
