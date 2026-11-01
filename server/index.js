import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { openDb, purgeOld } from './db.js';
import { SHAPES, PROPS, CLAIMS, toJest, toMarkdown, detectName } from './core.js';
import EXAMPLES from './examples.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RETENTION_DAYS = 30;
const MAX_CODE = 20000;
const MAX_CONCURRENT = 2;
const MAX_QUEUE = 20;
const JOB_TIMEOUT_MS = 90000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createApp({ dataDir, distDir } = {}) {
  dataDir = dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data');
  distDir = distDir || path.join(here, '..', 'dist');
  const db = openDb(dataDir);
  purgeOld(db, RETENTION_DAYS);
  const purgeTimer = setInterval(() => purgeOld(db, RETENTION_DAYS), 3600000);
  purgeTimer.unref();

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '120kb' }));

  /* ---------- tiny fixed-window rate limiter ---------- */
  const hits = new Map();
  const limit = (name, max, windowMs) => (req, res, next) => {
    const key = name + ':' + req.ip;
    const t = Date.now();
    const rec = hits.get(key);
    if (!rec || t > rec.reset) { hits.set(key, { n: 1, reset: t + windowMs }); return next(); }
    if (++rec.n > max) { res.set('Retry-After', String(Math.ceil((rec.reset - t) / 1000))); return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' }); }
    next();
  };
  setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (t > v.reset) hits.delete(k); }, 60000).unref();

  const clientId = (req) => {
    const id = req.get('x-client-id');
    if (!id || !UUID.test(id)) throw new HttpError(400, 'Missing or invalid x-client-id header');
    return id;
  };

  /* ---------- job manager ---------- */
  const jobs = new Map();
  const queue = [];
  let active = 0;

  function finishJob(id, job, patch) {
    job.done = true;
    const end = { type: 'end', status: patch.status };
    job.events.push(end);
    job.subs.forEach((s) => s(end));
    const keep = job.events.filter((e, i) => e.type !== 'case' || i < 80);
    db.prepare('UPDATE audits SET status=?, fn_name=?, score=?, verdict=?, result=?, events=?, error=? WHERE id=?')
      .run(patch.status, patch.fnName || null, patch.score ?? null, patch.verdict || null, patch.result ? JSON.stringify(patch.result) : null, JSON.stringify(keep), patch.error || null, id);
    setTimeout(() => jobs.delete(id), 60000).unref();
    active--; pump();
  }
  function pump() {
    while (active < MAX_CONCURRENT && queue.length) {
      const { id, input } = queue.shift();
      active++;
      const job = jobs.get(id);
      const worker = new Worker(new URL('./audit-worker.js', import.meta.url), { workerData: input, resourceLimits: { maxOldGenerationSizeMb: 256 } });
      let settled = false;
      const settle = (patch) => { if (settled) return; settled = true; clearTimeout(timer); worker.terminate(); finishJob(id, job, patch); };
      const timer = setTimeout(() => settle({ status: 'error', error: 'Audit exceeded ' + JOB_TIMEOUT_MS / 1000 + ' seconds and was stopped.' }), JOB_TIMEOUT_MS);
      worker.on('message', (m) => {
        if (m.kind === 'event') { job.events.push(m.e); job.subs.forEach((s) => s(m.e)); }
        else if (m.kind === 'done') settle({ status: 'done', fnName: m.result.fnName, score: m.result.score, verdict: m.result.verdict, result: m.result });
        else if (m.kind === 'error') settle({ status: 'error', error: m.message });
      });
      worker.on('error', (e) => settle({ status: 'error', error: 'Worker crashed: ' + e.message }));
      worker.on('exit', (code) => settle({ status: 'error', error: 'Worker exited unexpectedly (code ' + code + ')' }));
    }
  }

  /* ---------- validation ---------- */
  function parseInput(b) {
    if (!b || typeof b !== 'object') throw new HttpError(400, 'Request body must be JSON');
    const code = typeof b.code === 'string' ? b.code : '';
    const refCode = typeof b.refCode === 'string' ? b.refCode : '';
    if (!code.trim()) throw new HttpError(400, 'Paste the code you want to audit.');
    if (code.length > MAX_CODE || refCode.length > MAX_CODE) throw new HttpError(400, 'Code is limited to ' + MAX_CODE + ' characters.');
    if (!SHAPES[b.shape]) throw new HttpError(400, 'Choose a valid input shape.');
    const fnName = typeof b.fnName === 'string' && b.fnName.trim() ? b.fnName.trim() : detectName(code);
    if (!fnName || !/^[A-Za-z_$][\w$]*$/.test(fnName)) throw new HttpError(400, 'Could not find a function name. Define it as: function name(args) { ... }');
    const props = Array.isArray(b.props) ? b.props.filter((p) => PROPS[p] && p !== 'noThrow') : ['noMutation', 'deterministic'];
    const claim = CLAIMS[b.claim] ? b.claim : 'none';
    const runs = Math.max(50, Math.min(1000, parseInt(b.runs, 10) || 300));
    const seed = Number.isInteger(b.seed) ? b.seed : (parseInt(b.seed, 10) || 1);
    return { code, refCode, shape: b.shape, fnName, props, claim, runs, seed };
  }

  /* ---------- API ---------- */
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/api/config', (req, res) => {
    res.json({
      shapes: Object.entries(SHAPES).map(([id, s]) => ({ id, label: s.label, hasScale: !!s.scale })),
      props: Object.entries(PROPS).filter(([, p]) => !p.builtin || true).map(([id, p]) => ({ id, label: p.label, builtin: !!p.builtin })),
      claims: Object.entries(CLAIMS).map(([id, c]) => ({ id, label: c.label })),
      examples: EXAMPLES,
      limits: { maxCode: MAX_CODE, retentionDays: RETENTION_DAYS },
    });
  });

  app.post('/api/audits', limit('audit', 30, 10 * 60000), (req, res) => {
    const cid = clientId(req);
    if (queue.length >= MAX_QUEUE) throw new HttpError(503, 'The audit queue is full. Try again shortly.');
    const input = parseInput(req.body);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO audits (id, client_id, created_at, status, shape, fn_name, input) VALUES (?,?,?,?,?,?,?)')
      .run(id, cid, Date.now(), 'running', input.shape, input.fnName, JSON.stringify(input));
    jobs.set(id, { events: [], subs: new Set(), done: false });
    queue.push({ id, input });
    pump();
    res.status(202).json({ id });
  });

  app.get('/api/audits/:id/stream', (req, res) => {
    const id = req.params.id;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (e) => res.write('data: ' + JSON.stringify(e) + '\n\n');
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    res.on('close', () => clearInterval(ping));
    const job = jobs.get(id);
    if (job) {
      job.events.forEach(send);
      if (job.done) { clearInterval(ping); return res.end(); }
      const sub = (e) => { send(e); if (e.type === 'end') { clearInterval(ping); res.end(); } };
      job.subs.add(sub);
      res.on('close', () => job.subs.delete(sub));
      return;
    }
    const row = db.prepare('SELECT status, events FROM audits WHERE id = ?').get(id);
    if (!row) send({ type: 'error', message: 'Audit not found' });
    else { JSON.parse(row.events || '[]').forEach(send); send({ type: 'end', status: row.status }); }
    clearInterval(ping);
    res.end();
  });

  const publicRow = (r) => ({
    id: r.id, createdAt: r.created_at, status: r.status, error: r.error,
    input: (() => { const i = JSON.parse(r.input); return { code: i.code, refCode: i.refCode, shape: i.shape, fnName: i.fnName, props: i.props, claim: i.claim, runs: i.runs, seed: i.seed }; })(),
    result: r.result ? JSON.parse(r.result) : null,
  });
  const getRow = (id) => {
    const r = db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
    if (!r) throw new HttpError(404, 'Audit not found. It may have passed the ' + RETENTION_DAYS + ' day retention limit.');
    return r;
  };

  app.get('/api/audits', (req, res) => {
    const rows = db.prepare('SELECT id, created_at, status, fn_name, shape, score, verdict FROM audits WHERE client_id = ? ORDER BY created_at DESC LIMIT 100').all(clientId(req));
    res.json(rows.map((r) => ({ id: r.id, createdAt: r.created_at, status: r.status, fnName: r.fn_name, shape: r.shape, score: r.score, verdict: r.verdict })));
  });
  app.get('/api/audits/:id', (req, res) => res.json(publicRow(getRow(req.params.id))));
  app.delete('/api/audits/:id', (req, res) => {
    const r = db.prepare('DELETE FROM audits WHERE id = ? AND client_id = ?').run(req.params.id, clientId(req));
    if (!r.changes) throw new HttpError(404, 'Audit not found');
    res.json({ ok: true });
  });
  const attach = (res, name, type) => res.set({ 'Content-Type': type + '; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + name + '"' });
  app.get('/api/audits/:id/tests.js', (req, res) => {
    const row = publicRow(getRow(req.params.id));
    if (!row.result) throw new HttpError(409, 'Audit has no result yet');
    attach(res, row.result.fnName + '.regression.test.js', 'text/javascript').send(toJest(row.result));
  });
  app.get('/api/audits/:id/report.md', (req, res) => {
    const row = publicRow(getRow(req.params.id));
    if (!row.result) throw new HttpError(409, 'Audit has no result yet');
    attach(res, 'bluffcheck-' + row.result.fnName + '.md', 'text/markdown').send(toMarkdown(row.result));
  });

  /* ---------- frontend ---------- */
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use('/assets', express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/', (req, res) => res.status(200).type('text').send('API is running. Build the frontend with: npm run build'));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
  });

  app.locals.close = () => { clearInterval(purgeTimer); db.close(); };
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => console.log('BluffCheck listening on :' + port));
  const stop = () => server.close(() => { app.locals.close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
