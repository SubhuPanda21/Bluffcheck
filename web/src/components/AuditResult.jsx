import { useState } from 'react';
import { AnimatedGroup, AnimatedNumber, InView } from '../motion';

function fmt(v) {
  if (v === null || v === undefined) return 'undefined';
  try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch { return String(v); }
}

function GrowthChart({ complexity }) {
  const pts = complexity.points.filter((p) => p.ms > 0);
  if (pts.length < 2) return <p className="muted">Not enough measurable points to draw a curve.</p>;
  const W = 560, H = 260, P = { l: 56, r: 16, t: 16, b: 40 };
  const xs = pts.map((p) => Math.log(p.n)), ys = pts.map((p) => Math.log(p.ms));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
  const X = (v) => P.l + (v - x0) / (x1 - x0 || 1) * (W - P.l - P.r);
  const Y = (v) => H - P.b - (v - y0) / (y1 - y0 || 1) * (H - P.t - P.b);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(Math.log(p.n)).toFixed(1) + ' ' + Y(Math.log(p.ms)).toFixed(1)).join(' ');
  const ref = (slope) => 'M' + X(xs[0]).toFixed(1) + ' ' + Y(ys[0]).toFixed(1) + ' L' + X(x1).toFixed(1) + ' ' + Y(ys[0] + slope * (x1 - xs[0])).toFixed(1);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={'Log-log chart of runtime against input size. Fitted growth: ' + (complexity.slope === null ? 'unknown' : 'n to the power ' + complexity.slope.toFixed(2))}>
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="#fff" stroke="#0a0a0a" strokeWidth="3" />
        <path d={ref(1)} stroke="#00b140" strokeWidth="2" strokeDasharray="6 5" fill="none" />
        <path d={ref(2)} stroke="#ff3d00" strokeWidth="2" strokeDasharray="6 5" fill="none" />
        <path d={line} stroke="#0a0a0a" strokeWidth="4" fill="none" />
        {pts.map((p) => <rect key={p.n} x={X(Math.log(p.n)) - 5} y={Y(Math.log(p.ms)) - 5} width="10" height="10" fill="#ffe500" stroke="#0a0a0a" strokeWidth="3" />)}
        {pts.map((p) => <text key={'t' + p.n} x={X(Math.log(p.n))} y={H - 16} textAnchor="middle" fontSize="12" fontFamily="Space Mono, monospace">{p.n}</text>)}
        <text x={P.l} y={H - 2} fontSize="11" fontFamily="Space Mono, monospace">input size (log)</text>
        <text x="12" y={P.t + 10} fontSize="11" fontFamily="Space Mono, monospace" transform={`rotate(-90 12 ${P.t + 10})`} textAnchor="end">time (log)</text>
      </svg>
      <figcaption>
        <span className="key g">linear reference</span><span className="key r">quadratic reference</span><span className="key b">measured</span>
      </figcaption>
    </figure>
  );
}

export function AuditResult({ record }) {
  const r = record.result;
  const [copied, setCopied] = useState(false);
  if (!r) return null;
  const link = window.location.origin + '/a/' + record.id;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copy this link', link); } };
  return (
    <section className="result" aria-label="Audit result">
      <InView>
        <div className={'verdict ' + r.tier}>
          <div className="score"><AnimatedNumber value={r.score} duration={1.2} /><small>/100</small></div>
          <div>
            <h2>{r.verdict}</h2>
            <p><code>{r.fnName}</code> ran against {r.stats.total} inputs, {r.stats.failedCases} failed. Oracle confidence: {r.confidence}.</p>
            {r.note ? <p className="note">{r.note}</p> : null}
          </div>
        </div>
      </InView>

      <h3 className="rule">Findings ({r.findings.length})</h3>
      {r.findings.length === 0 ? <InView><p className="card">No findings. Every generated input agreed with the oracle and the growth probe matched your claim.</p></InView> : (
        <AnimatedGroup className="findings" itemClassName="finding-wrap" stagger={0.1}>
          {r.findings.map((f) => (
            <article className={'finding ' + f.sev} key={f.kind}>
              <header><span className={'tag ' + (f.sev === 'critical' ? 'crit' : 'high')}>{f.sev.toUpperCase()}</span><h4>{f.title}</h4>{f.failures ? <span className="muted small">{f.failures} of {f.of} cases</span> : null}</header>
              {f.call ? <pre data-lenis-prevent className="code-block">{f.call}</pre> : null}
              {f.hasExpected ? <dl className="ea"><div><dt>expected</dt><dd>{fmt(f.expected)}</dd></div><div><dt>actual</dt><dd>{fmt(f.actual)}</dd></div></dl> : null}
              <p>{f.explain}</p>
            </article>
          ))}
        </AnimatedGroup>
      )}

      {r.complexity ? (
        <InView>
          <h3 className="rule">Growth probe</h3>
          <div className="split-2">
            <GrowthChart complexity={r.complexity} />
            <div>
              <p>Measured growth: <strong>{r.complexity.slope === null ? 'inconclusive' : 'n^' + r.complexity.slope.toFixed(2)}</strong></p>
              <p>Classified as: <strong>{r.complexity.label}</strong></p>
              <p className="muted small">Timed inside the sandbox. Read the slope, not the milliseconds.</p>
              <table className="mini"><thead><tr><th>n</th><th>ms per call</th></tr></thead><tbody>
                {r.complexity.points.map((p) => <tr key={p.n}><td>{p.n}</td><td>{p.ms.toFixed(4)}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </InView>
      ) : null}

      <h3 className="rule">Take it with you</h3>
      <div className="actions">
        <button className="btn" onClick={copy}>{copied ? 'Link copied' : 'Copy share link'}</button>
        <a className="btn alt" href={'/api/audits/' + record.id + '/tests.js'}>Download Jest tests</a>
        <a className="btn alt" href={'/api/audits/' + record.id + '/report.md'}>Download report (.md)</a>
      </div>
      <p className="muted small">Anyone with the link can view this audit, including the code. It is deleted automatically after the retention period.</p>
    </section>
  );
}
