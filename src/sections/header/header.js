import './header.css';
import { $, $$ } from '../../utils/dom.js';

let links = [];

/** Fixed header: solid background once the page has scrolled. */
export function init() {
  const header = $('[data-header]');
  links = $$('[data-nav]', header);
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/** Underline the nav link for the section in view ('about' | 'projects' | … | '' for none). */
export function setActiveSection(section) {
  links.forEach((a) => {
    const on = a.dataset.nav === section;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
}
