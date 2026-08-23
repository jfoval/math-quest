// Strategy tips and little visuals shown the first time a fact is introduced.
export function tip(f) {
  const { op, a, b, ans } = f, hi = Math.max(a, b), lo = Math.min(a, b);
  if (op === 'add') {
    if (lo === 0) return 'Adding 0 changes nothing.';
    if (lo === 1) return 'Adding 1 is just counting up one.';
    if (lo === 2) return 'Adding 2: count up twice — skip one number.';
    if (a === b) return `Doubles! ${a} + ${a} = ${ans}. Doubles are worth memorising.`;
    if (hi - lo === 1) return `Near-doubles: ${lo} + ${lo} = ${lo * 2}, then one more = ${ans}.`;
    if (ans === 10) return `${a} and ${b} are ten-friends — they make 10!`;
    if (hi === 10) return `Adding 10 just puts a 1 in front: ${lo} → ${ans}.`;
    if (hi === 9) return `Adding 9: add 10 (${lo + 10}), then take 1 away = ${ans}.`;
    if (hi === 8) return `Adding 8: add 10 (${lo + 10}), then take 2 away = ${ans}.`;
    if (ans > 10) return `Make a ten: ${hi} needs ${10 - hi} more to reach 10, then ${lo - (10 - hi)} left over = ${ans}.`;
    return null;
  }
  if (op === 'sub') {
    if (b === 0) return 'Taking away 0 changes nothing.';
    if (a === b) return 'A number minus itself is always 0.';
    if (b === 1) return 'Minus 1 is just counting back one.';
    if (ans === b) return `${a} is double ${b}, so half of it is left: ${ans}.`;
    if (b === 10) return `Minus 10 just drops the 1 in front: ${a} → ${ans}.`;
    if (b === 9) return `Minus 9: take 10 (${a - 10}), then give 1 back = ${ans}.`;
    if (a === 10) return `Ten-friends: ${b} and ${ans} make 10.`;
    return `Think addition: ${b} + ? = ${a}. The missing part is ${ans}.`;
  }
  if (op === 'mul') {
    if (lo === 0) return 'Anything times 0 is 0.';
    if (lo === 1) return 'Times 1 keeps the number the same.';
    if (lo === 2) return `Times 2 is doubling: ${hi} + ${hi} = ${ans}.`;
    if (lo === 10) return `Times 10: just add a zero → ${ans}.`;
    if (lo === 11 && hi <= 9) return `Times 11: write the digit twice → ${ans}.`;
    if (lo === 5) return `Count by 5s: answers end in 0 or 5. ${hi} fives = ${ans}.`;
    if (lo === 9 && hi <= 10) return `×9 trick: tens digit is ${hi - 1}, and the digits add to 9 → ${ans}.`;
    if (lo === 4) return `Times 4: double, then double again. ${hi} → ${hi * 2} → ${ans}.`;
    if (lo === 3) return `Times 3: double it (${hi * 2}), then add one more ${hi} = ${ans}.`;
    if (a === b) return `${a} × ${a} = ${ans} is a square number.`;
    if (lo === 6) return `Times 6: it's ×5 (${hi * 5}) plus one more ${hi} = ${ans}.`;
    if (lo === 8) return `Times 8: double three times. ${hi} → ${hi * 2} → ${hi * 4} → ${ans}.`;
    if (lo === 12) return `Times 12: ×10 (${hi * 10}) plus ×2 (${hi * 2}) = ${ans}.`;
    if (lo === 7) return `7 × ${hi}: that's ${hi} × 5 (${hi * 5}) plus ${hi} × 2 (${hi * 2}) = ${ans}.`;
    return null;
  }
  if (op === 'div') {
    if (b === 1) return 'Dividing by 1 keeps the number the same.';
    if (ans === 0) return '0 divided by anything is 0.';
    if (a === b) return 'A number divided by itself is 1.';
    if (b === 2) return `Dividing by 2 is halving: half of ${a} is ${ans}.`;
    if (b === 10) return `Dividing by 10 drops the last zero: ${a} → ${ans}.`;
    return `Think multiplication: ${b} × ? = ${a}. The answer is ${ans}.`;
  }
  return null;
}

// Returns HTML for a compact visual of the fact.
export function visual(f) {
  const { op, a, b, ans } = f;
  const dot = (cls) => `<i class="${cls}"></i>`;
  if (op === 'add') {
    const dots = [...Array(a)].map(() => dot('da')).concat([...Array(b)].map(() => dot('db')));
    return frame(dots, 10);
  }
  if (op === 'sub') { // a dots, last b crossed out
    const dots = [...Array(a)].map((_, i) => dot(i >= a - b ? 'dx' : 'da'));
    return frame(dots, 10);
  }
  if (op === 'mul') {
    const r = Math.min(a, b) || 1, c = Math.max(a, b) || 1;
    if (a === 0 || b === 0) return `<div class="viz empty">nothing at all → 0</div>`;
    return `<div class="viz arr" style="grid-template-columns:repeat(${c},1fr)">${[...Array(r * c)].map(() => dot('da')).join('')}</div><div class="vizcap">${r} row${r === 1 ? '' : 's'} of ${c}</div>`;
  }
  if (op === 'div') {
    if (ans === 0) return `<div class="viz empty">0 shared out → 0 each</div>`;
    return `<div class="viz arr" style="grid-template-columns:repeat(${b},1fr)">${[...Array(a)].map((_, i) => dot(Math.floor(i / b) % 2 ? 'db' : 'da')).join('')}</div><div class="vizcap">${a} in rows of ${b} → ${ans} row${ans === 1 ? '' : 's'}</div>`;
  }
  return '';
}
function frame(dots, per) {
  if (!dots.length) return `<div class="viz empty">nothing → 0</div>`;
  const rows = []; for (let i = 0; i < dots.length; i += per) rows.push(`<div class="tf">${dots.slice(i, i + per).join('')}</div>`);
  return `<div class="viz">${rows.join('')}</div>`;
}
