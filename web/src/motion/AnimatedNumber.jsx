import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/** Counts up to a real value. Only use it for numbers that come from real results. */
export function AnimatedNumber({ value, duration = 1.1, decimals = 0, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const show = (v) => { node.textContent = v.toFixed(decimals); };
    if (reduce) { show(value); return undefined; }
    const c = animate(0, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: show });
    return () => c.stop();
  }, [value, duration, decimals, reduce]);
  return <span ref={ref} className={className}>{(0).toFixed(decimals)}</span>;
}
