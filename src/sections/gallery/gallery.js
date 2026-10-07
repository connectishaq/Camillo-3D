import './gallery.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, isMobile, prefersReducedMotion } from '../../utils/dom.js';

// how fast each photo drifts against the scroll, by its place in a row of the layout (×px from centre)
const SPEEDS = [0.1, -0.06, 0.16, -0.02];

/**
 * Gallery: the photos drift at slightly different speeds as they pass (transforms only,
 * from positions measured once per layout), the map stops drawing while the section covers
 * the screen, and any photo opens in the lightbox.
 */
export function init({ stage, scroll }) {
  const section = $('[data-gallery]');
  if (!section) return;
  initDrift(section);
  initLightbox(section, scroll);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onToggle: (self) => stage.setOccluded('gallery', self.isActive),
  });
}

function initDrift(section) {
  if (prefersReducedMotion()) return;
  const items = $$('[data-gallery-item]', section);
  let centres = [];
  const scale = () => (isMobile() ? 0.5 : 1);

  const measure = () => {
    items.forEach((el) => (el.style.transform = ''));
    centres = items.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    });
  };
  const apply = () => {
    const mid = window.scrollY + window.innerHeight / 2;
    const k = scale();
    items.forEach((el, i) => {
      const y = (centres[i] - mid) * SPEEDS[i % SPEEDS.length] * k;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  };

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onRefreshInit: measure,
    onRefresh: apply,
    onUpdate: apply,
  });
}

function initLightbox(section, scroll) {
  const box = $('[data-lightbox]', section);
  if (!box?.showModal) return;
  const photos = $$('[data-gallery-open] img', section);
  const img = $('[data-lightbox-img]', box);
  const count = $('[data-lightbox-count]', box);
  const name = $('[data-lightbox-name]', box);
  const suburb = $('[data-lightbox-suburb]', box);
  const link = $('[data-lightbox-link]', box);
  const total = String(photos.length).padStart(2, '0');
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    img.classList.remove('is-changing');
    void img.offsetWidth; // restart the fade
    img.classList.add('is-changing');
    img.src = p.dataset.full;
    img.alt = p.alt;
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${total}`;
    name.textContent = p.dataset.name;
    suburb.textContent = p.dataset.suburb;
    link.href = p.dataset.url;
    // warm the next one
    new Image().src = photos[(index + 1) % photos.length].dataset.full;
  };

  const open = (i, button) => {
    opener = button;
    show(i);
    box.showModal();
    scroll?.stop();
  };
  box.addEventListener('close', () => {
    scroll?.start();
    opener?.focus({ preventScroll: true });
  });

  $$('[data-gallery-open]', section).forEach((btn) => btn.addEventListener('click', () => open(+btn.dataset.galleryOpen, btn)));
  $('[data-lightbox-prev]', box).addEventListener('click', () => show(index - 1));
  $('[data-lightbox-next]', box).addEventListener('click', () => show(index + 1));
  $('[data-lightbox-close]', box).addEventListener('click', () => box.close());
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  // a click on the empty space around the photo closes it
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.classList.contains('lightbox__frame')) box.close();
  });
  // swipe between photos
  let startX = null;
  box.addEventListener('pointerdown', (e) => (startX = e.pointerType === 'mouse' ? null : e.clientX));
  box.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
}
