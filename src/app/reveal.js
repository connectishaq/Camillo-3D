import gsap from 'gsap';
import { $$, prefersReducedMotion } from '../utils/dom.js';

/** `[data-reveal]` content is readable at rest; it gets a gentle rise the first time it enters. */
export function initReveal() {
  if (prefersReducedMotion()) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        gsap.fromTo(e.target, { opacity: 0.35, y: 28 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' });
        io.unobserve(e.target);
      });
    },
    { threshold: 0.15 },
  );
  $$('[data-reveal]').forEach((el) => io.observe(el));
}
