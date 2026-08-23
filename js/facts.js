// Fact tables for each operation. Each fact: { id, a, b, ans, family, op }
// "family" = the bigger operand (e.g. the "7s"), used for placement inference and progress display.

export const OP_ORDER = ['add', 'sub', 'mul', 'div'];

export const OPS = {
  add: { key: 'add', name: 'Addition',       sym: '+', emoji: '🚀', planet: 'Planet Plus',   color: '#38bdf8', max: 10 },
  sub: { key: 'sub', name: 'Subtraction',    sym: '−', emoji: '🛸', planet: 'Minus Moon',    color: '#a78bfa', max: 10 },
  mul: { key: 'mul', name: 'Multiplication', sym: '×', emoji: '🪐', planet: 'Times Titan',   color: '#fb923c', max: 12 },
  div: { key: 'div', name: 'Division',       sym: '÷', emoji: '🌌', planet: 'Divide Nebula', color: '#34d399', max: 12 },
};

const cache = {};

export function allFacts(op) {
  if (cache[op]) return cache[op];
  const out = [];
  const M = OPS[op].max;
  if (op === 'add') {
    for (let a = 0; a <= M; a++) for (let b = a; b <= M; b++)
      out.push({ id: `${a}+${b}`, op, a, b, ans: a + b, family: Math.max(a, b) });
  } else if (op === 'sub') {
    // inverses of the addition facts: (a+b) - b = a
    for (let a = 0; a <= M; a++) for (let b = 0; b <= M; b++)
      out.push({ id: `${a + b}-${b}`, op, a: a + b, b, ans: a, family: Math.max(a, b) });
  } else if (op === 'mul') {
    for (let a = 0; a <= M; a++) for (let b = a; b <= M; b++)
      out.push({ id: `${a}x${b}`, op, a, b, ans: a * b, family: Math.max(a, b) });
  } else if (op === 'div') {
    // inverses of multiplication facts: (a*b) / b = a   (no dividing by zero)
    for (let a = 0; a <= M; a++) for (let b = 1; b <= M; b++)
      out.push({ id: `${a * b}/${b}`, op, a: a * b, b, ans: a, family: Math.max(a, b) });
  }
  cache[op] = out;
  return out;
}

export function factById(op, id) {
  return allFacts(op).find(f => f.id === id);
}

// Build a displayable question from a fact (commutative ops get randomly flipped).
export function makeQuestion(fact) {
  const { op } = fact;
  let a = fact.a, b = fact.b;
  if ((op === 'add' || op === 'mul') && Math.random() < 0.5) [a, b] = [b, a];
  return { fact, a, b, sym: OPS[op].sym, ans: fact.ans, text: `${a} ${OPS[op].sym} ${b}` };
}
