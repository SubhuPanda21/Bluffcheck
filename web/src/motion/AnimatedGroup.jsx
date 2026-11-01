import { Children } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];
const PRESETS = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } },
  'blur-slide': { hidden: { opacity: 0, y: 24, filter: 'blur(8px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } },
  scale: { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1 } },
};

/** Staggers its children in as the group enters the viewport. Mirrors Motion Primitives' AnimatedGroup. */
export function AnimatedGroup({ children, as = 'div', className, itemClassName, preset = 'blur-slide', stagger = 0.08, delay = 0, amount = 0.15, once = true }) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);
  if (reduce) { const Plain = as; return <Plain className={className}>{items.map((c, i) => <div key={i} className={itemClassName}>{c}</div>)}</Plain>; }
  const Tag = motion[as] || motion.div;
  const item = PRESETS[preset] || PRESETS['blur-slide'];
  return (
    <Tag className={className} initial="hidden" whileInView="visible" viewport={{ once, amount }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}>
      {items.map((c, i) => (
        <motion.div key={i} className={itemClassName} variants={item} transition={{ duration: 0.65, ease: EASE }}>{c}</motion.div>
      ))}
    </Tag>
  );
}
