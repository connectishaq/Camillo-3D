import './hero.css';
import gsap from 'gsap';
import { prefersReducedMotion } from '../../utils/dom.js';

/** Hero intro: the title block rises in once the loader has gone. */
export function init({ ready }) {
  if (prefersReducedMotion()) return;
  const items = document.querySelectorAll('.hero [data-reveal]');
  ready.then(() => {
    gsap.fromTo(items, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', stagger: 0.12 });
  });
}
