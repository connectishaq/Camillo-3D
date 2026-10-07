import './about.css';
import { $, $$, prefersReducedMotion } from '../../utils/dom.js';

/**
 * "About the project" (about.html): the copy rises in the first time the section comes on
 * screen, and while it's on screen the two photos drift against each other inside their frames
 * (each by its data-pabout-drift share of its distance from the middle of the screen).
 */
export function initAbout() {
  const section = $('[data-pabout]');
  if (!section || prefersReducedMotion()) return;
  const imgs = $$('[data-pabout-drift]', section).map((img) => ({ img, k: Number(img.dataset.paboutDrift) }));

  section.classList.add('is-ready');
  const rise = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      section.classList.add('is-in');
      rise.disconnect();
    },
    { threshold: 0.2 },
  );
  rise.observe(section);

  const apply = () => {
    const mid = window.innerHeight / 2;
    for (const { img, k } of imgs) {
      const box = img.parentElement.getBoundingClientRect();
      const off = box.top + box.height / 2 - mid;
      // capped inside the 12% the image is scaled up by, so no edge ever shows
      const y = Math.max(-0.05, Math.min(0.05, (off * k) / box.height)) * box.height;
      img.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    }
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      window.addEventListener('scroll', onScroll, { passive: true });
      apply();
    } else window.removeEventListener('scroll', onScroll);
  }).observe(section);
}
