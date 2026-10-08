import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $$, prefersReducedMotion } from '../utils/dom.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling (off for reduced motion), driven by GSAP's ticker so Lenis,
 * ScrollTrigger and the tweens share one clock, plus smooth in-page `#anchor` links (not
 * those marked `data-scroll-own`, which handle their own click).
 * Returns `{ scrollTo(target, options), stop(), start() }` (options: Lenis's scrollTo options).
 */
export function createSmoothScroll() {
  const reduce = prefersReducedMotion();
  const lenis = new Lenis({ lerp: reduce ? 1 : 0.085, smoothWheel: !reduce, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));

  const scrollTo = (target, options = {}) =>
    lenis.scrollTo(target, { offset: 0, duration: 1.6, ...options, immediate: reduce || options.immediate });

  $$('a[href^="#"]:not([data-scroll-own])').forEach((a) =>
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href === '#') return e.preventDefault(); // placeholder link (e.g. News, still to come)
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      scrollTo(target);
      // e.g. the skip link: move keyboard focus to the target too
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
    }),
  );

  return { scrollTo, stop: () => lenis.stop(), start: () => lenis.start() };
}
