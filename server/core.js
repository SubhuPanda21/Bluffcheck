// BluffCheck audit engine: differential fuzzing, property checks, shrinking, complexity probe.
// Pure logic. Untrusted code only ever runs through the sandbox passed to audit().

const now = () => performance.now();
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export function makeRng(seed) {
  let s = (seed >>> 0) || 123456789;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

/* ---------- input shapes ---------- */
const AL = 'aAbB ,.!1';
export const SHAPES = {
  'int[]': {
    label: 'int[]  (array of integers)',
    gen: (r, size) => [Array.from({ length: ri(r, 0, size) }, () => ri(r, -20, 20))],
    edges: () => [[[]], [[0]], [[-1]], [[2, 2]], [[5, 4, 3, 2, 1]], [[1, 2, 3, 4]], [[0, 0, 0]], [[-3, -1, -2]], [[3, 1, 2, 3, 1]]],
    scale: (r, n) => [Array.from({ length: n }, () => ri(r, 0, n))],
    valid: (a) => Array.isArray(a[0]) && a[0].every(Number.isInteger),
  },
  'sorted-int[],int': {
    label: 'sorted unique int[], int  (search style)',
    gen: (r, size) => {
      const set = new Set(); const n = ri(r, 0, size);
      while (set.size < n) set.add(ri(r, -30, 30));
      const a = [...set].sort((x, y) => x - y);
      const t = a.length && r() < 0.6 ? a[ri(r, 0, a.length - 1)] : ri(r, -32, 32);
      return [a, t];
    },
    edges: () => [[[], 1], [[1], 1], [[1], 0], [[1, 3], 3], [[1, 3], 1], [[1, 2, 3], 3], [[1, 2, 3, 4], 4], [[-5, 0, 5], -5]],
    scale: (r, n) => { const a = Array.from({ length: n }, (_, i) => i * 2); return [a, a[n - 1]]; },
    valid: (a) => {
      const arr = a[0];
      if (!Array.isArray(arr) || !Number.isInteger(a[1])) return false;
      for (let i = 1; i < arr.length; i++) if (!(arr[i] > arr[i - 1])) return false;
      return arr.every(Number.isInteger);
    },
  },
  int: {
    label: 'int  (single integer, includes 0 and negatives)',
    gen: (r) => [ri(r, -5, 60)],
    edges: () => [[0], [1], [-1], [2], [7], [16], [100]],
    scale: null,
    valid: (a) => Number.isInteger(a[0]),
  },
  string: {
    label: 'string  (mixed case, spaces, punctuation)',
    gen: (r, size) => [Array.from({ length: ri(r, 0, size) }, () => AL[ri(r, 0, AL.length - 1)]).join('')],
    edges: () => [[''], ['a'], ['Aa'], ['ab'], ['A man, a plan, a canal: Panama'], ['race a car'], ['  ']],
    scale: (r, n) => [Array.from({ length: n }, () => AL[ri(r, 0, AL.length - 1)]).join('')],
    valid: (a) => typeof a[0] === 'string',
  },
  intervals: {
    label: 'intervals  ([[start, end], ...])',
    gen: (r, size) => [Array.from({ length: ri(r, 0, size) }, () => { const a = ri(r, 0, 20); return [a, a + ri(r, 0, 6)]; })],
    edges: () => [[[]], [[[1, 3]]], [[[1, 2], [2, 3]]], [[[1, 4], [2, 3]]], [[[5, 6], [1, 2]]], [[[1, 3], [2, 6], [8, 10], [9, 12]]]],
    scale: (r, n) => [Array.from({ length: n }, () => { const a = ri(r, 0, n * 3); return [a, a + ri(r, 0, 5)]; })],
    valid: (a) => Array.isArray(a[0]) && a[0].every((p) => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] <= p[1]),
  },
};

/* ---------- helpers ---------- */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return a !== a && b !== b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
export function fmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'bigint') return v + 'n';
  if (typeof v === 'function') return '[function]';
  try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch { return String(v); }
}
export const fmtArgs = (args) => args.map(fmt).join(', ');

export function detectName(code) {
  let m = /function\s*\*?\s+([A-Za-z_$][\w$]*)\s*\(/.exec(code);
  if (m) return m[1];
  m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.exec(code);
  return m ? m[1] : null;
}

/* ---------- properties ---------- */
export const PROPS = {
  noThrow: { label: 'Never throws on valid input', builtin: true },
  noMutation: { label: 'Does not mutate its input', builtin: true },
  deterministic: { label: 'Same input gives same output', builtin: true },
  sorted: { label: 'Output is sorted ascending', check: (c) => (Array.isArray(c.res.value) && c.res.value.every((x, i, a) => i === 0 || a[i - 1] <= x)) ? null : 'output is not sorted ascending' },
  samePermutation: {
    label: 'Output is a permutation of the input',
    check: (c) => {
      const o = c.res.value, i = c.args[0];
      if (!Array.isArray(o) || !Array.isArray(i)) return 'output is not an array';
      if (o.length !== i.length) return 'output length differs from input length';
      const a = o.map(String).sort(), b = i.map(String).sort();
      return a.every((x, k) => x === b[k]) ? null : 'output elements differ from input elements';
    },
  },
  lengthPreserved: { label: 'Output length equals input length', check: (c) => (Array.isArray(c.res.value) && Array.isArray(c.args[0]) && c.res.value.length === c.args[0].length) ? null : 'output length differs from input length' },
  idempotent: {
    label: 'f(f(x)) equals f(x)',
    check: (c) => { const r2 = c.call([c.res.value]); return (r2.ok && deepEqual(r2.value, c.res.value)) ? null : 'applying the function twice changes the result'; },
  },
};

export const META = {
  mismatch: { sev: 'critical', title: 'Wrong output vs. reference', penalty: 30 },
  crash: { sev: 'critical', title: 'Throws on valid input', penalty: 25 },
  hang: { sev: 'critical', title: 'Does not terminate', penalty: 35 },
  mutation: { sev: 'high', title: 'Mutates its input', penalty: 15 },
  deterministic: { sev: 'high', title: 'Non-deterministic output', penalty: 20 },
  complexity: { sev: 'high', title: 'Complexity bluff', penalty: 20 },
};
const metaFor = (kind) => META[kind] || { sev: 'high', title: 'Property violated: ' + ((PROPS[kind] && PROPS[kind].label) || kind), penalty: 20 };

/* ---------- shrinking ---------- */
function* candidates(v) {
  if (Array.isArray(v)) {
    if (!v.length) return;
    yield [];
    for (let chunk = Math.floor(v.length / 2); chunk >= 1; chunk = Math.floor(chunk / 2)) {
      for (let i = 0; i + chunk <= v.length; i += chunk) yield v.slice(0, i).concat(v.slice(i + chunk));
    }
    for (let i = 0; i < v.length; i++) for (const c of candidates(v[i])) yield v.slice(0, i).concat([c], v.slice(i + 1));
  } else if (typeof v === 'number') {
    if (v !== 0) { yield 0; if (Math.abs(v) > 1) yield Math.trunc(v / 2); yield v > 0 ? v - 1 : v + 1; }
  } else if (typeof v === 'string') {
    if (v.length) {
      yield '';
      for (let i = 0; i < v.length; i++) yield v.slice(0, i) + v.slice(i + 1);
      for (let i = 0; i < v.length; i++) if (v[i] !== 'a') yield v.slice(0, i) + 'a' + v.slice(i + 1);
    }
  }
}
export function shrink(args, fails, valid, budget) {
  let cur = args, improved = true, steps = 0;
  while (improved && steps < budget) {
    improved = false;
    for (let ai = 0; ai < cur.length && !improved; ai++) {
      for (const c of candidates(cur[ai])) {
        if (++steps > budget) break;
        const next = cur.slice(); next[ai] = c;
        if (!valid(next)) continue;
        if (fails(next)) { cur = next; improved = true; break; }
      }
    }
  }
  return cur;
}

/* ---------- complexity ---------- */
function timeIt(callable, args, needClone) {
  let reps = 1, dt = 0;
  for (;;) {
    dt = callable.time(args, reps, needClone);
    if (dt === null) return null;
    if (dt >= 20 || reps >= 65536) break;
    reps *= 2;
  }
  return dt / reps;
}
function fitSlope(points) {
  const p = points.filter((q) => q.ms > 0);
  if (p.length < 3) return null;
  const xs = p.map((q) => Math.log(q.n)), ys = p.map((q) => Math.log(q.ms));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}
export const classify = (s) => (s < 0.35 ? 'O(1) to O(log n)' : s < 1.35 ? 'O(n) to O(n log n)' : s < 2.5 ? 'O(n²)' : 'O(n³) or worse');
export const CLAIMS = {
  none: { label: 'No claim', max: Infinity },
  log: { label: 'O(log n)', max: 0.5 },
  n: { label: 'O(n)', max: 1.35 },
  nlogn: { label: 'O(n log n)', max: 1.5 },
  n2: { label: 'O(n²)', max: 2.5 },
};

/* ---------- scoring ---------- */
export function score(findings, ctx) {
  let s = 100;
  findings.forEach((f) => { s -= f.penalty; });
  if (ctx.total) s -= Math.round(20 * ctx.failedCases / ctx.total);
  s = Math.max(0, Math.min(100, s));
  if (findings.some((f) => f.sev === 'critical')) s = Math.min(s, 55);
  let note = null;
  if (!ctx.hasOracle) {
    if (s > 85) note = 'Score capped at 85: no reference implementation or output property was supplied, so correctness could not be verified.';
    s = Math.min(s, 85);
  }
  const verdict = s >= 90 ? 'Looks solid' : s >= 60 ? 'Needs review' : 'Do not ship';
  const tier = s >= 90 ? 'good' : s >= 60 ? 'warn' : 'bad';
  return { score: s, verdict, tier, note };
}

/* ---------- the audit ---------- */
export function audit(opts, emit, sandbox) {
  emit = emit || (() => {});
  const t00 = now();
  const runs = Math.max(20, Math.min(opts.runs || 300, 1000));
  const shape = SHAPES[opts.shape];
  if (!shape) throw new Error('Unknown input shape: ' + opts.shape);
  const name = opts.fnName || detectName(opts.code || '');
  if (!name) throw new Error('Could not find a function in your code. Define something like: function myFn(x) { ... }');

  emit({ type: 'stage', id: 'compile' });
  const cand = sandbox.build(opts.code, name);
  if (!cand.hasFn) { cand.dispose(); throw new Error('Function "' + name + '" was not found after loading your code.'); }
  let ref = null;
  if (opts.refCode && opts.refCode.trim()) {
    const rn = opts.refName || detectName(opts.refCode);
    if (!rn) { cand.dispose(); throw new Error('Could not find a function in the reference code.'); }
    ref = sandbox.build(opts.refCode, rn);
    if (!ref.hasFn) { cand.dispose(); ref.dispose(); throw new Error('Reference function "' + rn + '" was not found.'); }
  }
  const props = (opts.props || ['noMutation', 'deterministic']).filter((p) => PROPS[p]);
  const rng = makeRng(opts.seed || 1);
  const firstFail = {}, failCount = {};
  let total = 0, failedCases = 0;

  function evaluate(args) {
    const out = [];
    const before = JSON.stringify(args);
    const res = cand.call(args);
    let r = null;
    if (ref) { r = ref.call(args); if (!r.ok) return out; }
    if (!res.ok) {
      out.push(res.error === 'LOOP_LIMIT' ? { kind: 'hang' } : { kind: 'crash', actual: res.error, expected: r ? r.value : undefined });
      return out;
    }
    if (r && !deepEqual(res.value, r.value)) out.push({ kind: 'mismatch', expected: r.value, actual: res.value });
    if (props.includes('noMutation') && JSON.stringify(res.args) !== before) out.push({ kind: 'mutation', before, after: JSON.stringify(res.args) });
    if (props.includes('deterministic')) {
      const res2 = cand.call(args);
      if (res2.ok && !deepEqual(res.value, res2.value)) out.push({ kind: 'deterministic', expected: res.value, actual: res2.value });
    }
    const ctx = { res, args: clone(args), call: (a) => cand.call(a) };
    props.forEach((p) => {
      if (PROPS[p].check) { const msg = PROPS[p].check(ctx); if (msg) out.push({ kind: p, msg, actual: res.value }); }
    });
    return out;
  }
  function runCase(args) {
    emit({ type: 'case', args: fmtArgs(args) });
    total++;
    const fs = evaluate(args);
    if (fs.length) {
      failedCases++;
      fs.forEach((f) => {
        failCount[f.kind] = (failCount[f.kind] || 0) + 1;
        if (!firstFail[f.kind]) { firstFail[f.kind] = { args: clone(args), f }; emit({ type: 'fail', kind: f.kind, args: fmtArgs(args) }); }
      });
    }
  }

  try {
    emit({ type: 'stage', id: 'edge' });
    shape.edges().forEach(runCase);

    emit({ type: 'stage', id: 'fuzz' });
    for (let i = 0; i < runs; i++) runCase(shape.gen(rng, Math.min(14, 1 + Math.floor(i / runs * 14))));

    emit({ type: 'stage', id: 'shrink' });
    const findings = [];
    Object.keys(firstFail).forEach((kind) => {
      const { args, f } = firstFail[kind];
      const small = shrink(args, (a) => evaluate(a).some((x) => x.kind === kind), shape.valid, kind === 'hang' ? 40 : 500);
      const d = evaluate(small).find((x) => x.kind === kind) || f;
      const m = metaFor(kind);
      let explain;
      if (kind === 'mismatch') explain = 'The candidate returned ' + fmt(d.actual) + ' but the reference implementation returned ' + fmt(d.expected) + '. This is the smallest input found that exposes it.';
      else if (kind === 'crash') explain = 'The function threw "' + d.actual + '" on an input that is valid for this shape.';
      else if (kind === 'hang') explain = 'The call was still running after 400 ms in the sandbox on a tiny input, so it almost certainly never terminates here. The sandbox interrupted it.';
      else if (kind === 'mutation') explain = 'The caller’s data was changed by the call: ' + d.before + ' became ' + d.after + '. Callers rarely expect this. Copy before sorting or editing.';
      else if (kind === 'deterministic') explain = 'Two calls with the same input returned different results (' + fmt(d.expected) + ' and ' + fmt(d.actual) + ').';
      else explain = (d.msg || 'Property violated') + '. Output was ' + fmt(d.actual) + '.';
      findings.push({
        kind, sev: m.sev, title: m.title, penalty: m.penalty, explain,
        args: small, call: name + '(' + fmtArgs(small) + ')',
        expected: d.expected === undefined ? null : d.expected, actual: d.actual === undefined ? null : d.actual,
        hasExpected: kind === 'mismatch', failures: failCount[kind], of: total,
      });
    });

    let complexity = null;
    if (shape.scale) {
      emit({ type: 'stage', id: 'complexity' });
      const needClone = !!firstFail.mutation;
      const sizes = [250, 500, 1000, 2000, 4000, 8000];
      const points = []; const tStart = now(); let timedOutAt = null;
      timeIt(cand, shape.scale(makeRng(99), sizes[0]), needClone);
      for (const n of sizes) {
        emit({ type: 'probe', n });
        const args = shape.scale(makeRng(n), n);
        let best = timeIt(cand, args, needClone);
        if (best === null) { timedOutAt = n; break; }
        if (best < 50) for (let t = 0; t < 2; t++) { const b = timeIt(cand, args, needClone); if (b !== null) best = Math.min(best, b); }
        points.push({ n, ms: best });
        if (best > 400 || now() - tStart > 10000) break;
      }
      const slope = fitSlope(points);
      complexity = { points, slope, label: slope === null ? 'inconclusive' : classify(slope), claim: opts.claim || 'none', timedOutAt };
      const claim = CLAIMS[complexity.claim] || CLAIMS.none;
      const m = metaFor('complexity');
      if (timedOutAt && claim.max < 2.5) {
        findings.push({ kind: 'complexity', sev: m.sev, title: 'Too slow at scale', penalty: m.penalty, explain: 'A single call on ' + timedOutAt + ' elements did not finish within 8 seconds in the sandbox, which does not fit the claimed ' + claim.label + '.', args: null, call: null, hasExpected: false, failures: null, of: null });
      } else if (slope !== null && slope > claim.max) {
        findings.push({ kind: 'complexity', sev: m.sev, title: m.title, penalty: m.penalty, explain: 'Claimed ' + claim.label + ', but runtime grows like n^' + slope.toFixed(2) + ' (' + classify(slope) + ') as input grows from ' + points[0].n + ' to ' + points[points.length - 1].n + ' elements. The output can be correct while the cost is not. Timing is measured inside QuickJS, so compare growth rates, not absolute milliseconds.', args: null, call: null, hasExpected: false, failures: null, of: null });
      }
    }

    emit({ type: 'stage', id: 'verdict' });
    const hasOracle = !!ref || props.some((p) => !PROPS[p].builtin);
    const ctx = { total, failedCases, hasOracle };
    const sc = score(findings, ctx);
    findings.sort((a, b) => (a.sev === 'critical' ? 0 : 1) - (b.sev === 'critical' ? 0 : 1));
    return {
      fnName: name, findings, complexity, ctx,
      confidence: ref ? 'High (reference oracle)' : hasOracle ? 'Medium (property oracle)' : 'Low (no oracle)',
      stats: { total, failedCases, failCount, ms: Math.round(now() - t00), runs },
      ...sc,
    };
  } finally {
    cand.dispose();
    if (ref) ref.dispose();
  }
}

/* ---------- exports ---------- */
export function toJest(result) {
  const fn = result.fnName;
  const lines = ['// Generated by BluffCheck: regression tests from minimal counterexamples', "const { " + fn + " } = require('./your-module');", ''];
  let any = false;
  result.findings.forEach((f) => {
    if (!f.args) return;
    any = true;
    const a = fmtArgs(f.args);
    lines.push("test('" + fn + ': ' + f.title.replace(/'/g, '') + "', () => {");
    if (f.kind === 'mismatch') lines.push('  expect(' + f.call + ').toEqual(' + fmt(f.expected) + ');');
    else if (f.kind === 'crash') lines.push('  expect(() => ' + f.call + ').not.toThrow();');
    else if (f.kind === 'mutation') lines.push('  const args = ' + fmt(f.args) + ';', '  const before = JSON.stringify(args);', '  ' + fn + '(...args);', '  expect(JSON.stringify(args)).toBe(before);');
    else if (f.kind === 'hang') lines.push('  // Must terminate. Run this under a test timeout: ' + f.call, '  expect(() => ' + f.call + ').not.toThrow();');
    else if (f.kind === 'deterministic') lines.push('  expect(' + fn + '(' + a + ')).toEqual(' + fn + '(' + a + '));');
    else lines.push('  // ' + f.explain, '  expect(' + f.call + ').toBeDefined();');
    lines.push('});', '');
  });
  if (!any) lines.push('// No counterexamples found, nothing to add.');
  return lines.join('\n');
}

export function toMarkdown(result) {
  const L = ['# BluffCheck report: `' + result.fnName + '`', '',
    '**Trust score:** ' + result.score + '/100 (' + result.verdict + ')  ',
    '**Oracle confidence:** ' + result.confidence + '  ',
    '**Cases run:** ' + result.stats.total + ', failing: ' + result.stats.failedCases + '  ', ''];
  if (result.note) L.push('> ' + result.note, '');
  if (!result.findings.length) L.push('No findings.', '');
  result.findings.forEach((f, i) => {
    L.push('## ' + (i + 1) + '. [' + f.sev.toUpperCase() + '] ' + f.title);
    if (f.call) L.push('Minimal counterexample: `' + f.call + '`');
    if (f.hasExpected) L.push('- expected: `' + fmt(f.expected) + '`', '- actual: `' + fmt(f.actual) + '`');
    L.push('', f.explain, '');
  });
  if (result.complexity && result.complexity.points.length) {
    L.push('## Complexity probe', '', '| n | ms per call |', '|---|---|');
    result.complexity.points.forEach((p) => L.push('| ' + p.n + ' | ' + p.ms.toFixed(4) + ' |'));
    L.push('', 'Measured growth: n^' + (result.complexity.slope === null ? '?' : result.complexity.slope.toFixed(2)) + ' (' + result.complexity.label + ')');
  }
  return L.join('\n');
}
