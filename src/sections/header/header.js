import './header.css';
import { $, $$ } from '../../utils/dom.js';
import { BREAKPOINT } from '../../config.js';

let header;
let links = [];
let menuLinks = [];

/**
 * Fixed header. On the home page the hero switches it to the "over map" style as the map
 * expands (`setOverMap`); on standalone pages (`overMapOnScroll`) it switches once scrolled.
 * On phones the nav is a menu button opening a full-screen menu (initMenu); `scroll` is the
 * home page's smooth scroller, paused while the menu is open.
 */
export function init({ overMapOnScroll = false, scroll } = {}) {
  header = $('[data-header]');
  links = $$('[data-nav]', header);
  initMenu(scroll);
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
  // the phone menu marks the same section
  menuLinks.forEach((a) => {
    const on = !!section && a.getAttribute('href').endsWith(`#${section}`);
    if (on) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
}

/**
 * Phones: the menu button opens the full-screen menu (header.html). While it's open the page
 * doesn't scroll, Tab stays on the button and the menu, and Esc, the button, a link or a wider
 * screen close it. A link closes the menu first, then does its usual thing (the smooth scroll
 * on the home page, or the page it points to).
 */
function initMenu(scroll) {
  const toggle = $('[data-menu-toggle]', header);
  const menu = $('[data-menu]');
  if (!toggle || !menu) return;
  const label = $('[data-menu-label]', toggle);
  menuLinks = $$('[data-menu-link]', menu).filter((a) => a.closest('.site-menu__nav'));
  let open = false;
  let timer = 0;

  const focusables = () => [toggle, ...$$('a[href], button', menu)];
  const onKey = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      toggle.focus();
    } else if (e.key === 'Tab') {
      const list = focusables();
      const i = list.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : i === list.length - 1 || i < 0 ? 0 : i + 1;
      e.preventDefault();
      list[next].focus();
    }
  };

  function setOpen(on) {
    if (on === open) return;
    open = on;
    clearTimeout(timer);
    toggle.setAttribute('aria-expanded', String(on));
    label.textContent = on ? 'Close menu' : 'Open menu';
    header.classList.toggle('is-menu-open', on);
    document.body.classList.toggle('is-locked', on);
    if (on) {
      scroll?.stop();
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      document.addEventListener('keydown', onKey);
    } else {
      scroll?.start();
      menu.classList.remove('is-open');
      timer = setTimeout(() => (menu.hidden = true), 350);
      document.removeEventListener('keydown', onKey);
    }
  }

  toggle.addEventListener('click', () => setOpen(!open));
  // close before the link's own handler scrolls the (unlocked) page
  menu.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('a')) setOpen(false);
    },
    true,
  );
  window.matchMedia(`(min-width: ${BREAKPOINT + 1}px)`).addEventListener('change', (e) => e.matches && setOpen(false));
}
