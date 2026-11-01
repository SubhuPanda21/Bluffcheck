import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];
const DEFAULT = { hidden: { opacity: 0, y: 28, filter: 'blur(6px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } };

/** Reveals children when they scroll into view. Mirrors Motion Primitives' InView. */
export function InView({ children, as = 'div', className, style, variants = DEFAULT, delay = 0, duration = 0.7, once = true, amount = 0.2 }) {
  const reduce = useReducedMotion();
  if (reduce) { const Plain = as; return <Plain className={className} style={style}>{children}</Plain>; }
  const Tag = motion[as] || motion.div;
  return (
    <Tag className={className} style={style} initial="hidden" whileInView="visible" viewport={{ once, amount }}
      variants={variants} transition={{ duration, delay, ease: EASE }}>
      {children}
    </Tag>
  );
}
