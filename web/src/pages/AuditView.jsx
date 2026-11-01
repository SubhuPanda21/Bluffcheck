import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { AuditResult } from '../components/AuditResult.jsx';
import { InView, TextEffect } from '../motion';

export default function AuditView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let stop = false;
    const load = () => api('/audits/' + id).then((r) => { if (stop) return; setRec(r); if (r.status === 'running') setTimeout(load, 1500); }).catch((e) => !stop && setErr(e.message));
    load();
    return () => { stop = true; };
  }, [id]);

  if (err) return <div className="workbench"><p className="alert" role="alert">{err}</p><Link className="btn" to="/audit">Start a new audit</Link></div>;
  if (!rec) return <div className="workbench"><p className="muted">Loading audit</p></div>;

  return (
    <div className="workbench">
      <TextEffect as="h1" per="word" className="page-title">{rec.input.fnName + ' audit'}</TextEffect>
      <p className="muted">Shape: {rec.input.shape}. Run on {new Date(rec.createdAt).toLocaleString()}.</p>
      {rec.status === 'running' ? <p className="card">This audit is still running. The page will update when it finishes.</p> : null}
      {rec.status === 'error' ? <p className="alert" role="alert">This audit could not run: {rec.error}</p> : null}
      <InView>
        <div className="grid-2">
          <div><span className="label">Code audited</span><pre data-lenis-prevent className="code-block tall">{rec.input.code}</pre></div>
          <div><span className="label">Reference</span><pre data-lenis-prevent className="code-block tall">{rec.input.refCode || 'No reference supplied.'}</pre></div>
        </div>
      </InView>
      {rec.status === 'done' ? <AuditResult record={rec} /> : null}
      <div className="actions">
        <button className="btn alt" onClick={() => nav('/audit', { state: { prefill: rec.input } })}>Audit this code again</button>
      </div>
    </div>
  );
}
