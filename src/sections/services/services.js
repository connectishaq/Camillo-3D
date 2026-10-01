import './services.css';
import gsap from 'gsap';
import { $, $$, prefersReducedMotion } from '../../utils/dom.js';

/**
 * Stats count up from 0 the first time the overview panel scrolls into view. The real
 * numbers are in the HTML (for search engines and no-JS visitors) and are reset to 0 here.
 */
export function init() {
  const panel = $('.overview');
  const counters = $$('[data-count]', panel);
  if (prefersReducedMotion() || !counters.length) return;
  counters.forEach((el) => (el.textContent = '0'));

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      counters.forEach(countUp);
      io.disconnect();
    },
    { threshold: 0.15 },
  );
  io.observe(panel);
}

function countUp(el) {
  const obj = { v: 0 };
  gsap.to(obj, {
    v: +el.dataset.count,
    duration: 1.8,
    ease: 'power2.out',
    onUpdate: () => (el.textContent = Math.round(obj.v)),
  });
}
