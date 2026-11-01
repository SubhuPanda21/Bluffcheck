import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';

export function PageTransition({ children }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  if (reduce) return children;
  return (
    <motion.div key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
