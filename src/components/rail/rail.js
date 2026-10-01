import './rail.css';
import { escapeHtml } from '../../utils/escape.js';

/**
 * Progress rail: one dot per chapter, labelled with the chapter's `data-label`.
 * Returns `{ setActive(index) }`.
 */
export function createRail(chapters, { onSelect }, el = document.querySelector('[data-rail]')) {
  el.innerHTML = chapters
    .map((c, i) => {
      const label = escapeHtml(c.dataset.label);
      return `<button class="rail__dot" type="button" data-i="${i}" aria-label="${label}"><span>${label}</span></button>`;
    })
    .join('');
  const dots = [...el.children];
  dots.forEach((d) => d.addEventListener('click', () => onSelect(+d.dataset.i)));

  return {
    setActive(index) {
      dots.forEach((d, j) => {
        d.classList.toggle('is-active', j === index);
        if (j === index) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
    },
  };
}
