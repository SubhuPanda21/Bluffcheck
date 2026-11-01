import { Fragment } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];
const PRESETS = {
  'fade-in-blur': { hidden: { opacity: 0, y: 14, filter: 'blur(10px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } },
  blur: { hidden: { opacity: 0, filter: 'blur(12px)' }, visible: { opacity: 1, filter: 'blur(0px)' } },
  slide: { hidden: { opacity: 0, y: '0.6em' }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
};

/** Staggered text reveal. API mirrors Motion Primitives' TextEffect. */
export function TextEffect({ children, per = 'word', as = 'p', preset = 'fade-in-blur', delay = 0, stagger, duration = 0.6, className, style, once = true, trigger }) {
  const reduce = useReducedMotion();
  const text = typeof children === 'string' ? children : String(children ?? '');
  if (reduce) { const Plain = as; return <Plain className={className} style={style}>{text}</Plain>; }
  const Tag = motion[as] || motion.p;
  const gap = stagger ?? (per === 'char' ? 0.02 : per === 'line' ? 0.14 : 0.06);
  const p = PRESETS[preset] || PRESETS['fade-in-blur'];
  const container = { hidden: {}, visible: { transition: { staggerChildren: gap, delayChildren: delay } } };
  const unit = { hidden: p.hidden, visible: { ...p.visible, transition: { duration, ease: EASE } } };
  const trig = trigger === undefined
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once, amount: 0.3 } }
    : { initial: 'hidden', animate: trigger ? 'visible' : 'hidden' };
  const box = { display: 'inline-block' };

  let body;
  if (per === 'line') {
    body = text.split('\n').map((line, i) => (
      <motion.span key={i} variants={unit} style={{ display: 'block' }}>{line}</motion.span>
    ));
  } else {
    const words = text.split(/\s+/).filter(Boolean);
    body = words.map((w, wi) => (
      <Fragment key={wi}>
        <span style={{ ...box, whiteSpace: 'nowrap' }}>
          {per === 'char'
            ? [...w].map((c, ci) => <motion.span key={ci} variants={unit} style={box}>{c}</motion.span>)
            : <motion.span variants={unit} style={box}>{w}</motion.span>}
        </span>
        {wi < words.length - 1 ? ' ' : null}
      </Fragment>
    ));
  }
  return <Tag className={className} style={style} variants={container} aria-label={text} {...trig}><span aria-hidden="true" style={{ display: 'contents' }}>{body}</span></Tag>;
}
