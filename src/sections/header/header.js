import './header.css';
import { $, $$ } from '../../utils/dom.js';

let header;
let links = [];

/**
 * Fixed header. On the home page the hero switches it to the "over map" style as the map
 * expands (`setOverMap`); on standalone pages (`overMapOnScroll`) it switches once scrolled.
 */
export function init({ overMapOnScroll = false } = {}) {
  header = $('[data-header]');
  links = $$('[data-nav]', header);
  if (!overMapOnScroll) return;
  const update = () => setOverMap(window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/** White logo and links, for when the header sits over the hero photography. */
export function setOnPhoto(on) {
  header?.classList.toggle('is-on-photo', on);
}

/** Light translucent bar, for when the header sits over the map or content. */
export function setOverMap(on) {
  header?.classList.toggle('is-over-map', on);
}

/** Underline the nav link for the section in view ('about' | 'projects' | … | '' for none). */
export function setActiveSection(section) {
  links.forEach((a) => {
    const on = !!section && a.dataset.nav === section;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
}
