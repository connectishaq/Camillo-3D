import gsap from 'gsap';

/**
 * Watches the story sections. When a chapter crosses the middle of the viewport it
 * becomes active: the map flies, the rail/locator/nav update and its content reveals.
 */
export function initChapters({ onChange, scrollTo }) {
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const rail = document.querySelector('[data-rail]');
  const locator = document.querySelector('[data-locator-text]');
  const navLinks = [...document.querySelectorAll('.site-nav a')];

  rail.innerHTML = chapters
    .map((c, i) => `<button class="rail__dot" data-i="${i}" aria-label="${c.dataset.label}"><span>${c.dataset.label}</span></button>`)
    .join('');
  const dots = [...rail.children];
  dots.forEach((d) => d.addEventListener('click', () => scrollTo(chapters[+d.dataset.i])));

  let current = -1;
  const activate = (i) => {
    if (i === current) return;
    current = i;
    const c = chapters[i];
    dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    locator.textContent = c.dataset.label;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === `#${sectionFor(c)}`));
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

  // Reveal on enter
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const items = e.target.matches('[data-reveal]') ? [e.target] : [];
        gsap.fromTo(items, { opacity: 0.35, y: 28 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' });
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        revealIO.unobserve(e.target);
      });
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => revealIO.observe(el));
}

function sectionFor(chapter) {
  const key = chapter.dataset.chapter;
  if (key === 'office') return 'about';
  if (key === 'projectsIntro' || key.startsWith('project:')) return 'projects';
  if (key === 'overview') return 'services';
  if (key === 'contact') return 'contact';
  return '';
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
