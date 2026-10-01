import Lenis from 'lenis';
import { $$, prefersReducedMotion } from '../utils/dom.js';

/**
 * Lenis smooth scrolling (off for reduced motion), plus smooth in-page `#anchor` links.
 * Returns `{ scrollTo(target), stop(), start() }`.
 */
export function createSmoothScroll() {
  const reduce = prefersReducedMotion();
  const lenis = new Lenis({ lerp: reduce ? 1 : 0.085, smoothWheel: !reduce });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  const scrollTo = (target) => lenis.scrollTo(target, { offset: 0, duration: 1.6, immediate: reduce });

  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      scrollTo(target);
      // e.g. the skip link: move keyboard focus to the target too
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
    }),
  );

  return { scrollTo, stop: () => lenis.stop(), start: () => lenis.start() };
}
