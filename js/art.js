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
      <path d="M10 44 Q50 34 90 42" stroke="rgba(255,255,255,.22)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M12 62 Q50 54 88 62" stroke="rgba(120,40,0,.28)" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M20 74 Q50 68 80 74" stroke="rgba(255,255,255,.14)" stroke-width="4" fill="none" stroke-linecap="round"/>` },
    div: { base: ['#6ee7b7', '#065f46'], detail: `
      <path d="M50 50 m0 -3 a3 3 0 1 1 -3 3 a8 8 0 1 0 8 -8 a15 15 0 1 1 -15 15 a22 22 0 1 0 22 -22" stroke="rgba(255,255,255,.28)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="30" cy="34" r="2.2" fill="#fff" opacity=".9"/><circle cx="68" cy="28" r="1.6" fill="#fff" opacity=".8"/><circle cx="72" cy="66" r="2" fill="#fff" opacity=".9"/><circle cx="34" cy="70" r="1.4" fill="#fff" opacity=".8"/>` },
  }[op];
  return `<svg class="planet-art" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="${id}a" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${defs.base[0]}"/><stop offset="1" stop-color="${defs.base[1]}"/></radialGradient>
      <clipPath id="${id}c"><circle cx="50" cy="50" r="40"/></clipPath>
    </defs>
    ${op === 'mul' ? `<path d="M4 58 A46 13 0 0 1 96 42" stroke="#fde68a" stroke-width="6" fill="none" opacity=".7" stroke-linecap="round" transform="rotate(-8 50 50)"/>` : ''}
    <circle cx="50" cy="50" r="40" fill="url(#${id}a)"/>
    <g clip-path="url(#${id}c)">${defs.detail}</g>
    ${op === 'mul' ? `<path d="M4 58 A46 13 0 0 0 96 42" stroke="#fde68a" stroke-width="6" fill="none" opacity=".95" stroke-linecap="round" transform="rotate(-8 50 50)"/><path d="M4 58 A46 13 0 0 0 96 42" stroke="#f59e0b" stroke-width="2" fill="none" opacity=".9" transform="rotate(-8 50 50) translate(0,4)"/>` : ''}
    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
    <ellipse cx="36" cy="30" rx="12" ry="7" fill="rgba(255,255,255,.35)" transform="rotate(-30 36 30)"/>
  </svg>`;
}

export function rocket(size = 48, flame = 1) {
  return `<svg class="rocket-art" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <g class="flame" style="transform-origin:18px 32px;transform:scaleX(${flame})">
      <path d="M18 25 L4 32 L18 39 Z" fill="#fb923c"/><path d="M18 28 L9 32 L18 36 Z" fill="#fde047"/>
    </g>
    <path d="M26 20 L18 12 L18 24 Z" fill="#ef4444"/><path d="M26 44 L18 52 L18 40 Z" fill="#ef4444"/>
    <path d="M18 22 H46 V42 H18 Z" fill="#f1f5ff"/>
    <path d="M18 22 H46 V30 H18 Z" fill="#fff" opacity=".5"/>
    <path d="M46 22 Q62 32 46 42 Z" fill="#ef4444"/>
    <circle cx="36" cy="32" r="6.5" fill="#0b1026"/><circle cx="36" cy="32" r="4.5" fill="#38bdf8"/><circle cx="34.5" cy="30.5" r="1.5" fill="#fff"/>
    <rect x="18" y="22" width="4" height="20" fill="#cbd5e1"/>
  </svg>`;
}

export function asteroid(size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7 L9 2 L15 4 L18 10 L14 17 L7 18 L2 13 Z" fill="#9ca3af"/><circle cx="8" cy="9" r="2" fill="#6b7280"/><circle cx="13" cy="12" r="1.5" fill="#6b7280"/></svg>`;
}
