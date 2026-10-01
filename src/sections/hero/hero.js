import './hero.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion } from '../../utils/dom.js';
import { BREAKPOINT, HERO_PANEL } from '../../config.js';
import { setOverMap } from '../header/header.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Split hero → full-screen map.
 *
 * The map canvas stays fixed and full screen the whole time (no WebGL resizes); only a
 * `clip-path: inset(…)` on the stage changes, from the measured `[data-hero-panel]` box to
 * the whole viewport. Scrubbed over ~100vh while the hero is pinned, and reversible. The
 * camera is told how far the expand is (`stage.setIntro`) so the CBD stays centred in the
 * visible panel and eases back to the normal framing. With reduced motion: no pin or scrub,
 * just a quick cross-fade between the two states.
 */
export function init({ ready, stage }) {
  const section = $('.chapter--hero');
  const panel = $('[data-hero-panel]');
  const content = $('.hero__content');
  const stageEl = $('.stage');
  if (!section || !panel || !stageEl) return;

  let geom = measure();
  const apply = (progress) => {
    const p = gsap.parseEase('power2.inOut')(progress);
    const k = 1 - p; // 1 = hero panel, 0 = full screen
    const { top, right, bottom, left, radius, narrow } = geom;
    const r = radius * k;
    stageEl.style.clipPath =
      k > 0.0005 ? `inset(${top * k}px ${right * k}px ${bottom * k}px ${left * k}px round ${r}px ${narrow ? r : 0}px 0 0)` : 'none';
    stage.setIntro({ amount: k, x: geom.cx * k, y: geom.cy * k, zoom: 1 + (HERO_PANEL.zoomOut - 1) * k });
    const full = progress > 0.98;
    // glass header as soon as the map slides up underneath it
    setOverMap(progress > 0 && top * k < geom.headerH + 4);
    document.body.classList.toggle('is-map-full', full);
  };

  ScrollTrigger.addEventListener('refreshInit', () => (geom = measure()));
  window.addEventListener('resize', () => {
    geom = measure();
    apply(state.p);
  });
  const state = { p: 0 };
  apply(0);

  if (prefersReducedMotion()) {
    // no pin, no scrub: cross-fade to the full map once the hero starts to leave
    let full = false;
    const swap = (toFull) => {
      if (toFull === full) return;
      full = toFull;
      gsap
        .timeline()
        .to(stageEl, { opacity: 0, duration: 0.2 })
        .add(() => apply((state.p = toFull ? 1 : 0)))
        .to(stageEl, { opacity: 1, duration: 0.3 });
    };
    ScrollTrigger.create({ trigger: section, start: 'top+=15% top', onEnter: () => swap(true), onLeaveBack: () => swap(false) });
    return;
  }

  // One timeline per layout. On mobile the panel starts right under the text, so the text
  // has to be gone almost at once; on desktop it sits beside the panel and can linger.
  // (matchMedia only runs the callback when a condition matches, so list both layouts)
  const layouts = { narrow: `(max-width: ${BREAKPOINT}px)`, wide: `(min-width: ${BREAKPOINT + 1}px)` };
  gsap.matchMedia().add(layouts, ({ conditions }) => {
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    tl.to(state, { p: 1, duration: 1, onUpdate: () => apply(state.p) }, 0);
    tl.to(
      content,
      {
        x: conditions.narrow ? 0 : -80,
        y: conditions.narrow ? -24 : 0,
        autoAlpha: 0,
        duration: conditions.narrow ? 0.15 : 0.4,
        ease: 'power1.in',
      },
      0,
    );
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${window.innerHeight * HERO_PANEL.scrollLength}`,
      pin: true,
      scrub: true,
      animation: tl,
      invalidateOnRefresh: true,
      // past the hero the map is always full screen, whatever the scrub last rendered
      onLeave: () => apply((state.p = 1)),
      onRefresh: (self) => self.progress === 1 && apply((state.p = 1)),
    });
  });

  // intro: the text block rises in once the loader has gone
  const items = content.children;
  gsap.set(items, { opacity: 0, y: 30 });
  ready.then(() => gsap.to(items, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1 }));

  /** Panel box relative to the hero (which sits at the top of the viewport while pinned). */
  function measure() {
    const s = section.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const narrow = vw <= BREAKPOINT;
    const top = r.top - s.top;
    const left = r.left - s.left;
    const right = Math.max(0, vw - (left + r.width));
    const bottom = Math.max(0, vh - (top + r.height));
    return {
      headerH: document.querySelector('[data-header]')?.offsetHeight || 0,
      top,
      left,
      right,
      bottom,
      narrow,
      radius: narrow ? HERO_PANEL.radiusMobile : r.width * HERO_PANEL.radius,
      // panel centre relative to the screen centre: the camera centres the CBD there
      cx: left + (vw - left - right) / 2 - vw / 2,
      cy: top + (vh - top - bottom) / 2 - vh / 2,
    };
  }
}
