import { $$ } from '../utils/dom.js';
import { createRail } from '../components/rail/rail.js';
import { createLocator } from '../components/locator/locator.js';
import { setActiveSection } from '../sections/header/header.js';

/**
 * Watches the story chapters (`[data-chapter]`). When one crosses the middle of the
 * viewport it becomes active: the rail, locator and header nav update and `onChange`
 * flies the map there. A chapter's `data-nav` names the header link it belongs to.
 */
export function initChapters({ onChange, scrollTo }) {
  const chapters = $$('[data-chapter]');
  const rail = createRail(chapters, { onSelect: (i) => scrollTo(chapters[i]) });
  const locator = createLocator();

  let current = -1;
  const activate = (i) => {
    if (i === current) return;
    current = i;
    const c = chapters[i];
    rail.setActive(i);
    locator.set(c.dataset.label);
    setActiveSection(c.dataset.nav || '');
    onChange(c.dataset.chapter, c);
  };

  // chapters touching the band across the middle of the screen; when two do (a jump can leave
  // the last one to report being the one that's leaving), the one under the middle line wins
  const inBand = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target)));
      if (!inBand.size) return;
      const mid = window.innerHeight / 2;
      const list = chapters.filter((c) => inBand.has(c));
      const hit = list.find((c) => {
        const r = c.getBoundingClientRect();
        return r.top <= mid && r.bottom > mid;
      });
      activate(chapters.indexOf(hit || list.at(-1)));
    },
    { rootMargin: '-48% 0px -48% 0px' },
  );
  chapters.forEach((c) => io.observe(c));
}
