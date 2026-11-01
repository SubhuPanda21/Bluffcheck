import test from 'node:test';
import assert from 'node:assert/strict';
import { initSandbox } from '../server/sandbox.js';
import { audit, toJest, toMarkdown } from '../server/core.js';
import EXAMPLES from '../server/examples.js';

const sandbox = await initSandbox();
const byId = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]));
const run = (ex, extra = {}) => audit({ code: ex.code, refCode: ex.ref, shape: ex.shape, props: ex.props, claim: ex.claim, runs: 300, seed: 7, ...extra }, null, sandbox);
const kinds = (r) => r.findings.map((f) => f.kind);

test('binarySearch: off-by-one is found and shrunk to a tiny input', () => {
  const r = run(byId['binary-search']);
  assert.ok(kinds(r).includes('mismatch'));
  const f = r.findings.find((x) => x.kind === 'mismatch');
  assert.ok(f.args[0].length <= 2, 'shrunk array should be tiny: ' + f.call);
  assert.equal(r.tier, 'bad');
});

test('median: wrong even-length middle and input mutation are both found', () => {
  const r = run(byId.median);
  assert.ok(kinds(r).includes('mismatch'));
  assert.ok(kinds(r).includes('mutation'));
});

test('dedupe: output is correct, but the O(n) claim is caught by the probe', () => {
  const r = run(byId.dedupe);
  assert.ok(!kinds(r).includes('mismatch'));
  assert.ok(kinds(r).includes('complexity'), 'slope was ' + (r.complexity && r.complexity.slope));
  assert.ok(r.complexity.slope > 1.35);
});

test('mergeIntervals: touching intervals bug and mutation are found', () => {
  const r = run(byId['merge-intervals']);
  assert.ok(kinds(r).includes('mismatch'));
  assert.ok(kinds(r).includes('mutation'));
});

test('isPalindrome: case handling bug is found', () => {
  const r = run(byId.palindrome);
  assert.ok(kinds(r).includes('mismatch'));
});

test('floorLog2: non-termination is stopped by the sandbox and reported as a hang', () => {
  const r = run(byId['floor-log2']);
  assert.ok(kinds(r).includes('hang'));
  const f = r.findings.find((x) => x.kind === 'hang');
  assert.ok(/floorLog2\((0|-\d+)\)/.test(f.call), f.call);
});

test('maxSubarray: a correct function is not accused', () => {
  const r = run(byId.kadane);
  assert.deepEqual(kinds(r).filter((k) => k !== 'complexity'), []);
  assert.ok(r.score >= 80, 'score ' + r.score);
});

test('no oracle: score is capped and explained', () => {
  const ex = byId.kadane;
  const r = audit({ code: ex.code, shape: ex.shape, props: ['noMutation'], claim: 'none', runs: 100, seed: 3 }, null, sandbox);
  assert.ok(r.score <= 85);
  assert.ok(r.confidence.startsWith('Low'));
});

test('sandbox cannot reach the host', () => {
  const r = audit({ code: 'function probe(a){ return [typeof process, typeof require, typeof fetch, globalThis.constructor.constructor("return typeof process")()]; }', refCode: 'function probe(a){ return ["undefined","undefined","undefined","undefined"]; }', shape: 'int[]', props: [], runs: 30 }, null, sandbox);
  assert.ok(!kinds(r).includes('mismatch'), JSON.stringify(r.findings));
});

test('exports are generated', () => {
  const r = run(byId['binary-search']);
  assert.match(toJest(r), /expect\(binarySearch\(/);
  assert.match(toMarkdown(r), /BluffCheck report/);
});

test('bad code gives a clear error instead of crashing', () => {
  assert.throws(() => audit({ code: 'function (', shape: 'int[]' }, null, sandbox), /Could not find a function|failed to load/);
});
