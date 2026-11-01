import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { AnimatedGroup, TextEffect } from '../motion';

export default function History() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/audits').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (id) => { try { await api('/audits/' + id, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); } };

  return (
    <div className="workbench">
      <TextEffect as="h1" per="word" className="page-title">Your audits</TextEffect>
      <p className="lead">Listed by a random ID stored in this browser. Clearing site data removes access to this list, but shared links keep working until the audit expires.</p>
      {err ? <p className="alert" role="alert">{err}</p> : null}
      {rows && rows.length === 0 ? <div className="card"><p>No audits yet.</p><Link className="btn" to="/audit">Run your first audit</Link></div> : null}
      {rows && rows.length ? (
        <AnimatedGroup className="history" itemClassName="history-item" stagger={0.05}>
          {rows.map((r) => (
            <div className="row card" key={r.id}>
              <span className={'score-chip ' + (r.status !== 'done' ? 'none' : r.score >= 90 ? 'good' : r.score >= 60 ? 'warn' : 'bad')}>{r.status === 'done' ? r.score : r.status}</span>
              <div>
                <Link to={'/a/' + r.id}><strong>{r.fnName}</strong></Link>
                <div className="muted small">{r.shape} | {new Date(r.createdAt).toLocaleString()} {r.verdict ? '| ' + r.verdict : ''}</div>
              </div>
              <button className="btn alt small-btn" onClick={() => remove(r.id)} aria-label={'Delete audit of ' + r.fnName}>Delete</button>
            </div>
          ))}
        </AnimatedGroup>
      ) : null}
    </div>
  );
}
