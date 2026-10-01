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

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) activate(chapters.indexOf(e.target));
      });
    },
    { rootMargin: '-48% 0px -48% 0px' },
  );
  chapters.forEach((c) => io.observe(c));
}
