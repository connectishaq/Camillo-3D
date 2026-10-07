import './hero.css';
import { $, $$, prefersReducedMotion } from '../../utils/dom.js';
import { setOnPhoto, setOverMap } from '../../sections/header/header.js';

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const ease = (t) => 1 - Math.pow(1 - clamp01(t), 3);

/**
 * Project hero (hero.html): the photo holds while the name line, always running sideways like a
 * marquee (faster while the page scrolls), rises over it,
 * and each figure box eases up into place as it arrives. The header is white over the photo
 * and turns to the light bar once the boxes reach it (white type would vanish on them). All on one scroll handler, writing
 * transforms and opacity only, from positions measured once per layout.
 * Returns false when the page has no hero.
 */
export function initHero() {
  const hero = $('[data-phero]');
  if (!hero) return false;
  const reduce = prefersReducedMotion();
  const img = $('.phero__img', hero);
  const track = $('[data-phero-track]', hero);
  const run = $('.phero__run', track);
  const stats = $$('[data-phero-stat]', hero);

  let runWidth = 0;
  let boxesTop = 0;
  let statTops = [];
  const measure = () => {
    runWidth = run.getBoundingClientRect().width;
    stats.forEach((el) => (el.style.transform = ''));
    statTops = stats.map((el) => el.getBoundingClientRect().top + window.scrollY);
    boxesTop = Math.min(...statTops);
  };

  let onPhoto = null;
  const apply = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    // the header: white type over the bare photo, the light bar once the boxes reach it
    const over = y + 80 < boxesTop;
    if (over !== onPhoto) {
      onPhoto = over;
      setOnPhoto(over);
      setOverMap(!over);
    }
    if (reduce) return;
    // the photo slowly closes in
    img.style.transform = `scale(${(1 + Math.min(y / vh, 3) * 0.035).toFixed(4)})`;
    // each box rises in over the bottom quarter of the screen
    stats.forEach((el, i) => {
      const t = ease((y + vh - statTops[i]) / (vh * 0.3));
      el.style.transform = `translate3d(0, ${((1 - t) * 70).toFixed(1)}px, 0)`;
      el.style.opacity = (0.25 + 0.75 * t).toFixed(3);
    });
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
  const relayout = () => {
    measure();
    apply();
  };
  // the name: a marquee that runs on its own and is pushed along by the scroll (back a little
  // when scrolling up), drawn only while the line is on screen
  let x = 0;
  let lastT = 0;
  let lastY = window.scrollY;
  let frame = 0;
  const tick = (t) => {
    frame = requestAnimationFrame(tick);
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0;
    lastT = t;
    const y = window.scrollY;
    x += window.innerWidth * 0.06 * dt + (y - lastY) * 0.6;
    lastY = y;
    if (!runWidth) return;
    x = ((x % runWidth) + runWidth) % runWidth;
    track.style.transform = `translate3d(${(-x).toFixed(1)}px, 0, 0)`;
  };
  if (!reduce) {
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!e.isIntersecting) return;
      lastT = 0;
      lastY = window.scrollY;
      frame = requestAnimationFrame(tick);
    }).observe($('.phero__name', hero));
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);
  img.decode?.().then(relayout, relayout);
  relayout();
  return true;
}
