import { motion } from 'motion/react';

export const STAGES = [
  ['compile', 'Load code in sandbox'],
  ['edge', 'Edge cases'],
  ['fuzz', 'Fuzz against reference'],
  ['shrink', 'Shrink failures'],
  ['complexity', 'Probe growth'],
  ['verdict', 'Score'],
];

/** shown = how many of the seen stages have been revealed; ended = server finished. */
export function Pipeline({ seen, shown, ended, ticker }) {
  const current = shown > 0 ? seen[shown - 1] : null;
  return (
    <div className="pipeline card" aria-live="polite">
      <ol>
        {STAGES.map(([id, label]) => {
          const idx = seen.indexOf(id);
          const revealed = idx >= 0 && idx < shown;
          const done = revealed && (idx < shown - 1 || (ended && shown >= seen.length));
          const active = revealed && !done;
          const skipped = ended && idx < 0;
          return (
            <motion.li key={id} className={(done ? 'done ' : '') + (active ? 'active ' : '') + (skipped ? 'skipped' : '')}
              animate={active ? { x: 6 } : { x: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
              <span className="dot" aria-hidden="true" />
              <span>{label}</span>
              <em>{done ? 'done' : active ? 'running' : skipped ? 'not applicable' : 'waiting'}</em>
            </motion.li>
          );
        })}
      </ol>
      <div className="ticker" aria-hidden="true">
        {ticker.length === 0 ? <span>waiting for first case</span> : ticker.map((t, i) => <span key={t.k} style={{ opacity: 0.35 + (i + 1) / ticker.length * 0.65 }} className={t.fail ? 'fail' : ''}>{t.fail ? 'FAIL ' : t.probe ? 'size ' : 'case '}{t.text}</span>)}
      </div>
      <p className="muted small">{current ? 'Current stage: ' + STAGES.find((s) => s[0] === current)[1] : 'Starting'}</p>
    </div>
  );
}
