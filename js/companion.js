// Bolt: the ship's robot. Drawn in SVG with moods; talks in short lines with a consistent personality
// (upbeat, a little goofy, loves facts, never scolds).
export function bolt(mood = 'idle', size = 72) {
  const eyes = {
    idle: '<circle cx="26" cy="30" r="5" fill="#0b1026"/><circle cx="44" cy="30" r="5" fill="#0b1026"/><circle cx="27.5" cy="28.5" r="1.6" fill="#fff"/><circle cx="45.5" cy="28.5" r="1.6" fill="#fff"/>',
    happy: '<path d="M21 31 q5 -7 10 0" stroke="#0b1026" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M39 31 q5 -7 10 0" stroke="#0b1026" stroke-width="3" fill="none" stroke-linecap="round"/>',
    excited: '<path d="M22 30 l4 -4 l4 4 l-4 4 z" fill="#0b1026"/><path d="M40 30 l4 -4 l4 4 l-4 4 z" fill="#0b1026"/>',
    think: '<circle cx="26" cy="30" r="5" fill="#0b1026"/><circle cx="44" cy="30" r="5" fill="#0b1026"/><circle cx="28" cy="27" r="1.6" fill="#fff"/><circle cx="46" cy="27" r="1.6" fill="#fff"/><path d="M20 22 l12 2" stroke="#0b1026" stroke-width="2.5" stroke-linecap="round"/>',
    sad: '<circle cx="26" cy="31" r="5" fill="#0b1026"/><circle cx="44" cy="31" r="5" fill="#0b1026"/><circle cx="25" cy="32" r="1.6" fill="#fff"/><circle cx="43" cy="32" r="1.6" fill="#fff"/><path d="M20 23 l12 4 M50 23 l-12 4" stroke="#0b1026" stroke-width="2.5" stroke-linecap="round"/>',
    sleepy: '<path d="M21 31 h10 M39 31 h10" stroke="#0b1026" stroke-width="3" stroke-linecap="round"/>',
  }[mood] || '';
  const mouth = {
    idle: '<rect x="29" y="40" width="12" height="3" rx="1.5" fill="#0b1026"/>',
    happy: '<path d="M27 40 q8 8 16 0" stroke="#0b1026" stroke-width="3" fill="none" stroke-linecap="round"/>',
    excited: '<ellipse cx="35" cy="42" rx="6" ry="4.5" fill="#0b1026"/><ellipse cx="35" cy="44" rx="3" ry="1.8" fill="#fb7185"/>',
    think: '<path d="M29 42 q6 -4 12 0" stroke="#0b1026" stroke-width="3" fill="none" stroke-linecap="round"/>',
    sad: '<path d="M27 44 q8 -6 16 0" stroke="#0b1026" stroke-width="3" fill="none" stroke-linecap="round"/>',
    sleepy: '<ellipse cx="35" cy="42" rx="3" ry="2.5" fill="#0b1026"/>',
  }[mood] || '';
  return `<svg class="bolt bolt-${mood}" width="${size}" height="${size}" viewBox="0 0 70 76" aria-hidden="true">
    <defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient></defs>
    <g class="bolt-antenna"><line x1="35" y1="12" x2="35" y2="4" stroke="#94a3b8" stroke-width="3"/><circle cx="35" cy="3.5" r="3.5" fill="#fde047" class="bolt-bulb"/></g>
    <rect x="13" y="12" width="44" height="38" rx="11" fill="url(#bg1)" stroke="#475569" stroke-width="2"/>
    <rect x="18" y="18" width="34" height="27" rx="8" fill="#38bdf8"/>
    ${eyes}${mouth}
    <rect x="8" y="30" width="5" height="12" rx="2.5" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/><rect x="57" y="30" width="5" height="12" rx="2.5" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
    <rect x="30" y="50" width="10" height="4" fill="#64748b"/>
    <rect x="19" y="54" width="32" height="14" rx="5" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <circle cx="29" cy="61" r="2.5" fill="#34d399"/><circle cx="41" cy="61" r="2.5" fill="#fb923c"/>
    <rect x="16" y="67" width="38" height="6" rx="3" fill="#334155"/><circle cx="21" cy="70" r="2" fill="#94a3b8"/><circle cx="35" cy="70" r="2" fill="#94a3b8"/><circle cx="49" cy="70" r="2" fill="#94a3b8"/>
  </svg>`;
}

const pick = a => a[Math.floor(Math.random() * a.length)];
export const lines = {
  greet(kid, { streak = 0, due = 0, hour = new Date().getHours() } = {}) {
    const t = hour < 12 ? 'Morning' : hour < 18 ? 'Hey' : 'Evening';
    const opts = [`${t}, Captain ${kid.name}! Systems ready.`, `${t}! I polished the rocket while you were gone.`, `Captain ${kid.name}! I've been counting stars. There are a lot.`];
    if (streak >= 3) opts.push(`${streak} days in a row! Your brain is getting seriously strong.`);
    if (due > 8) opts.push(`${due} facts are ready for a re-check. Let's keep them sharp!`);
    return pick(opts);
  },
  teach: [`New one! Say it out loud with me.`, `Brand-new fact. Let's lock it in.`, `Here's a fresh one. I'll remember it if you do!`, `New fact detected! Type it once so it sticks.`],
  miss: [`No worries — now you know it.`, `That one's tricky. We'll see it again soon.`, `Close! Type the real answer and it's yours.`, `Even robots miss sometimes. Let's fix it.`],
  missTwice: [`Hmm, this one keeps wriggling away. Look at the hint.`, `Let's slow down on this one. Say it out loud.`],
  combo: [`You're on fire!`, `Whoa, look at that combo!`, `Engines at full power!`, `Unstoppable!`],
  summary: { 3: [`Perfect flight! I barely had to steer.`, `Flawless. Are you sure you're not a robot?`], 2: [`Great flying, Captain.`, `Nice! A few more and this planet's yours.`], 1: [`Every mission makes the next one easier.`, `Tough one — but we landed. That counts.`] },
  unlock: [`A new planet just appeared on the map!`, `New planet unlocked. Pack snacks.`],
  buy: [`Ooh, shiny! Great choice.`, `The base looks better already.`, `I'll install that right away.`],
  broke: [`Not enough stars yet. A mission or two should do it.`, `Almost! Blast a few asteroids and come back.`],
  lightning: [`Lightning round! Fingers ready?`, `Thirty seconds. Go go go!`],
  boss: [`A boss! Answer fast for critical hits.`, `It's big. But you're smart. Let's go.`],
  idle: [`Did you know 9 × 9 = 81? Just saying.`, `I like sevens. They're my favorite. Don't tell the eights.`, `Pick a planet and let's fly!`],
};
export { pick };
