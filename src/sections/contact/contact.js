import './contact.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $ } from '../../utils/dom.js';

/**
 * Contact (the footer): while it fills the screen the map doesn't need drawing, and the story
 * rail and locator step aside (they'd sit over the form).
 */
export function init({ stage }) {
  const section = $('[data-contact]');
  if (!section) return;
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'max',
    onToggle: (self) => stage.setOccluded('footer', self.isActive),
  });
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'max',
    onToggle: (self) => document.body.classList.toggle('is-in-footer', self.isActive),
  });
}
