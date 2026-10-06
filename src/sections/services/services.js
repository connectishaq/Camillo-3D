import './services.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, prefersReducedMotion } from '../../utils/dom.js';

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const smooth = (t) => (t = clamp01(t)) * t * (3 - 2 * t);

/**
 * What we build: like the Featured Projects panel, the overview's white grows from the panel
 * to fill the whole screen as it arrives (panel top from 85% to 25% of the screen), holds while
 * the content scrolls through, and leaves with the end of the section, onto the city for
 * Contact. Stats count up from 0 the first time the panel scrolls into view.
 */
export function init({ stage }) {
  const panel = $('.overview');
  if (!panel) return;
  initGrow(panel, stage);
  initCounters(panel);
}

function initGrow(panel, stage) {
  const section = panel.closest('section');
  const bg = $('[data-overview-bg]', section);
  if (!bg) return;
  document.body.classList.add('has-overview-bg');
  const reduce = prefersReducedMotion();
  const radius = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 26;

  let covered = false;
  let grown = false;
  const apply = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = panel.getBoundingClientRect();
    const s = section.getBoundingClientRect();
    const g = smooth((0.85 * vh - p.top) / (0.6 * vh));
    const k = 1 - g;
    // the bottom edge: the panel's while it grows, then the section's end, so it leaves with it
    const bottom = Math.max(0, vh - (k * p.bottom + g * s.bottom));
    const top = Math.max(0, k * p.top);
    const visible = top < vh && bottom < vh && s.bottom > 0;
    bg.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) {
      if (reduce) {
        // no shape change: the panel keeps its own white, then the full screen fades in
        bg.style.clipPath = `inset(0 0 ${bottom.toFixed(1)}px 0)`;
        bg.style.opacity = g.toFixed(3);
        document.body.classList.toggle('has-overview-bg', g >= 1);
      } else {
        const px = (v) => `${v.toFixed(1)}px`;
        bg.style.clipPath = `inset(${px(top)} ${px(k * (vw - p.right))} ${px(bottom)} ${px(k * p.left)} round ${px(radius * k)})`;
      }
    }
    if (g > 0.02 !== grown) panel.classList.toggle('is-grown', (grown = g > 0.02));
    // while the white fills the screen, the map underneath doesn't need drawing
    const full = g >= 1 && top === 0 && bottom === 0;
    if (full !== covered) stage.setOccluded('overview', (covered = full));
  };

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: apply,
    onRefresh: apply,
    onLeave: apply,
    onLeaveBack: apply,
  });
  apply();
}

function initCounters(panel) {
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
