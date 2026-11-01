import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/index.js';
import EXAMPLES from '../server/examples.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bluff-'));
const app = createApp({ dataDir: dir, distDir: path.join(dir, 'none') });
const server = app.listen(0);
const base = 'http://127.0.0.1:' + server.address().port;
const cid = '123e4567-e89b-42d3-a456-426614174000';
const H = { 'content-type': 'application/json', 'x-client-id': cid };
test.after(() => { server.close(); app.locals.close(); });

async function waitDone(id) {
  const res = await fetch(base + '/api/audits/' + id + '/stream');
  const text = await res.text();
  const events = text.split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
  return events;
}

test('full flow: create, stream, fetch, export, list, delete', async () => {
  const ex = EXAMPLES.find((e) => e.id === 'binary-search');
  const res = await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code: ex.code, refCode: ex.ref, shape: ex.shape, props: ex.props, claim: ex.claim, runs: 200 }) });
  assert.equal(res.status, 202);
  const { id } = await res.json();
  const events = await waitDone(id);
  assert.ok(events.some((e) => e.type === 'stage' && e.id === 'fuzz'));
  assert.equal(events.at(-1).type, 'end');
  assert.equal(events.at(-1).status, 'done');

  const rec = await (await fetch(base + '/api/audits/' + id)).json();
  assert.equal(rec.status, 'done');
  assert.ok(rec.result.findings.some((f) => f.kind === 'mismatch'));
  assert.equal(rec.clientId, undefined);

  const tests = await (await fetch(base + '/api/audits/' + id + '/tests.js')).text();
  assert.match(tests, /binarySearch/);
  const md = await (await fetch(base + '/api/audits/' + id + '/report.md')).text();
  assert.match(md, /Trust score/);

  const list = await (await fetch(base + '/api/audits', { headers: H })).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].verdict, rec.result.verdict);

  const other = await (await fetch(base + '/api/audits', { headers: { 'x-client-id': '223e4567-e89b-42d3-a456-426614174000' } })).json();
  assert.equal(other.length, 0, 'history is scoped to the client id');

  const del = await fetch(base + '/api/audits/' + id, { method: 'DELETE', headers: H });
  assert.equal(del.status, 200);
  assert.equal((await fetch(base + '/api/audits/' + id)).status, 404);
});

test('replay of a finished audit works from the database', async () => {
  const ex = EXAMPLES.find((e) => e.id === 'kadane');
  const { id } = await (await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code: ex.code, refCode: ex.ref, shape: ex.shape, props: ex.props, claim: ex.claim, runs: 100 }) })).json();
  await waitDone(id);
  await new Promise((r) => setTimeout(r, 100));
  const events = await waitDone(id);
  assert.equal(events.at(-1).type, 'end');
});

test('a user program with an infinite loop cannot hang the server', async () => {
  const code = 'function spin(a){ while(true){} }';
  const { id } = await (await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code, shape: 'int[]', props: ['noMutation'], runs: 50 }) })).json();
  const events = await waitDone(id);
  assert.equal(events.at(-1).status, 'done');
  const rec = await (await fetch(base + '/api/audits/' + id)).json();
  assert.ok(rec.result.findings.some((f) => f.kind === 'hang'));
  assert.equal((await fetch(base + '/healthz')).status, 200);
});

test('validation and errors', async () => {
  let r = await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code: '', shape: 'int[]' }) });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'function f(){}', shape: 'int[]' }) });
  assert.equal(r.status, 400);
  r = await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code: 'function f(){}', shape: 'nope' }) });
  assert.equal(r.status, 400);
  const { id } = await (await fetch(base + '/api/audits', { method: 'POST', headers: H, body: JSON.stringify({ code: 'function f( {', shape: 'int[]' }) })).json();
  await waitDone(id);
  const rec = await (await fetch(base + '/api/audits/' + id)).json();
  assert.equal(rec.status, 'error');
  assert.ok(rec.error.length > 5);
});
