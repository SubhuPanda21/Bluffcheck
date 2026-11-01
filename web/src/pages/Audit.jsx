import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useConfig } from '../useConfig.js';
import { InView, TextEffect } from '../motion';
import { Pipeline } from '../components/Pipeline.jsx';
import { AuditResult } from '../components/AuditResult.jsx';

const BLANK = { code: '', refCode: '', shape: 'int[]', claim: 'none', props: ['noMutation', 'deterministic'], runs: 300, fnName: '' };

export default function Audit() {
  const { cfg, error } = useConfig();
  const [params] = useSearchParams();
  const loc = useLocation();
  const [form, setForm] = useState(BLANK);
  const [exId, setExId] = useState(null);
  const [run, setRun] = useState(null);
  const [err, setErr] = useState('');
  const [ticker, setTicker] = useState([]);
  const tickRef = useRef([]);
  const esRef = useRef(null);
  const resultRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pick = (e) => { setExId(e.id); setForm({ code: e.code, refCode: e.ref, shape: e.shape, claim: e.claim, props: e.props, runs: 300, fnName: '' }); setRun(null); setErr(''); };

  useEffect(() => {
    if (loc.state && loc.state.prefill) { setForm({ ...BLANK, ...loc.state.prefill, fnName: '' }); return; }
    const ex = params.get('example');
    if (cfg && ex) { const e = cfg.examples.find((x) => x.id === ex); if (e) pick(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  useEffect(() => () => esRef.current && esRef.current.close(), []);

  // Reveal stages one at a time so each one is readable, and refresh the case ticker.
  const runId = run && run.id;
  useEffect(() => {
    if (!runId) return undefined;
    const t = setInterval(() => {
      setRun((r) => (r && r.shown < r.seen.length ? { ...r, shown: r.shown + 1 } : r));
      setTicker(tickRef.current.slice());
    }, 320);
    return () => clearInterval(t);
  }, [runId]);

  // Safety net: if the stream drops, poll the record.
  useEffect(() => {
    if (!runId || (run && run.ended)) return undefined;
    const t = setInterval(() => {
      api('/audits/' + runId).then((rec) => { if (rec.status !== 'running') setRun((r) => (r && !r.ended ? { ...r, ended: true, record: rec } : r)); }).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [runId, run && run.ended]);

  const showResult = run && run.ended && run.record && run.shown >= run.seen.length;
  useEffect(() => {
    if (showResult && resultRef.current) {
      const top = resultRef.current.getBoundingClientRect().top + window.scrollY - 90;
      if (window.__lenis) window.__lenis.scrollTo(top); else window.scrollTo({ top, behavior: 'smooth' });
    }
  }, [showResult]);

  async function start() {
    setErr(''); tickRef.current = []; setTicker([]);
    if (esRef.current) esRef.current.close();
    setRun({ id: null, seen: [], shown: 0, ended: false, record: null });
    try {
      const { id } = await api('/audits', { method: 'POST', body: JSON.stringify(form) });
      setRun((r) => ({ ...r, id }));
      const es = new EventSource('/api/audits/' + id + '/stream');
      esRef.current = es;
      let n = 0;
      es.onmessage = (m) => {
        const e = JSON.parse(m.data);
        if (e.type === 'stage') setRun((r) => (r ? { ...r, seen: [...r.seen, e.id] } : r));
        else if (e.type === 'case' || e.type === 'probe' || e.type === 'fail') {
          tickRef.current = [...tickRef.current.slice(-4), { k: ++n, text: e.type === 'probe' ? String(e.n) : e.args, fail: e.type === 'fail', probe: e.type === 'probe' }];
        } else if (e.type === 'end') {
          es.close();
          api('/audits/' + id).then((rec) => setRun((r) => (r ? { ...r, ended: true, record: rec } : r))).catch((x) => setErr(x.message));
        }
      };
    } catch (x) { setErr(x.message); setRun(null); }
  }

  const busy = run && !run.ended;
  const rec = run && run.record;

  return (
    <div className="workbench">
      <TextEffect as="h1" per="word" className="page-title">Audit a function</TextEffect>
      <InView delay={0.15}><p className="lead">Pick an example to see what a finding looks like, or paste your own function. Add a reference implementation so correctness can be checked.</p></InView>

      {error ? <p className="alert" role="alert">Could not load settings from the server: {error}</p> : null}

      <div className="examples" role="group" aria-label="Examples">
        <span className="label">Examples</span>
        {cfg ? cfg.examples.map((e) => (
          <button key={e.id} className={'chip' + (exId === e.id ? ' on' : '')} onClick={() => pick(e)} title={e.blurb}>{e.name}<small>{e.tag}</small></button>
        )) : <span className="muted">loading</span>}
      </div>
      {exId && cfg ? <p className="muted">{cfg.examples.find((e) => e.id === exId).blurb}</p> : null}

      <div className="grid-2">
        <div>
          <label className="label" htmlFor="code">Code to audit (JavaScript)</label>
          <textarea id="code" data-lenis-prevent spellCheck={false} rows={16} value={form.code} maxLength={cfg ? cfg.limits.maxCode : 20000}
            onChange={(e) => set('code', e.target.value)} placeholder={'function myFunction(input) {\n  // paste the AI-written code here\n}'} />
          <label className="label" htmlFor="ref">Reference implementation (trusted, may be slow)</label>
          <textarea id="ref" data-lenis-prevent spellCheck={false} rows={9} value={form.refCode} maxLength={cfg ? cfg.limits.maxCode : 20000}
            onChange={(e) => set('refCode', e.target.value)} placeholder={'function myFunction(input) {\n  // the simple, obviously correct version\n}'} />
        </div>

        <aside className="card settings">
          <h3>Settings</h3>
          <label className="label" htmlFor="shape">Input shape</label>
          <select id="shape" value={form.shape} onChange={(e) => set('shape', e.target.value)}>
            {cfg ? cfg.shapes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>) : <option>loading</option>}
          </select>

          <label className="label" htmlFor="claim">Claimed time complexity</label>
          <select id="claim" value={form.claim} onChange={(e) => set('claim', e.target.value)}>
            {cfg ? cfg.claims.map((c) => <option key={c.id} value={c.id}>{c.label}</option>) : null}
          </select>

          <fieldset>
            <legend className="label">Properties to enforce</legend>
            {cfg ? cfg.props.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={p.id === 'noThrow' || form.props.includes(p.id)} disabled={p.id === 'noThrow'}
                  onChange={() => set('props', form.props.includes(p.id) ? form.props.filter((x) => x !== p.id) : [...form.props, p.id])} />
                <span>{p.label}</span>
              </label>
            )) : null}
          </fieldset>

          <label className="label" htmlFor="runs">Random cases ({form.runs})</label>
          <input id="runs" type="range" min="50" max="1000" step="50" value={form.runs} onChange={(e) => set('runs', Number(e.target.value))} />

          <label className="label" htmlFor="fn">Function name (optional)</label>
          <input id="fn" type="text" value={form.fnName} onChange={(e) => set('fnName', e.target.value)} placeholder="detected automatically" spellCheck={false} />

          <button className="btn wide" onClick={start} disabled={busy || !form.code.trim()}>{busy ? 'Running' : 'Run audit'}</button>
          {err ? <p className="alert" role="alert">{err}</p> : null}
        </aside>
      </div>

      {run ? (
        <InView>
          <h3 className="rule">Live run</h3>
          <Pipeline seen={run.seen} shown={run.shown} ended={run.ended && run.shown >= run.seen.length} ticker={ticker} />
        </InView>
      ) : null}

      <div ref={resultRef}>
        {showResult && rec.status === 'error' ? <p className="alert" role="alert">The audit could not run: {rec.error}</p> : null}
        {showResult && rec.status === 'done' ? <AuditResult record={rec} /> : null}
      </div>
    </div>
  );
}
