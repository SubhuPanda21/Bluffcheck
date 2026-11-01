import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import Lenis from 'lenis';

/** Inertial page scrolling (Lenis). Skipped when the visitor prefers reduced motion. */
export function SmoothScroll({ children }) {
  const reduce = useReducedMotion();
  const { pathname } = useLocation();
  useEffect(() => {
    if (reduce) return undefined;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    let id = requestAnimationFrame(function raf(t) { lenis.raf(t); id = requestAnimationFrame(raf); });
    window.__lenis = lenis;
    return () => { cancelAnimationFrame(id); lenis.destroy(); window.__lenis = null; };
  }, [reduce]);
  useEffect(() => {
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
  }, [pathname]);
  return children;
}

export function ScrollProgress({ className }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  return <motion.div className={className} style={{ scaleX, transformOrigin: '0 50%', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60 }} aria-hidden="true" />;
}
