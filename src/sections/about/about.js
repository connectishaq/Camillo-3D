import './about.css';
import './hq-map.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion } from '../../utils/dom.js';
import { lerp } from '../../utils/math.js';
import { SCENE, sceneScroll } from './scene.js';

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const smooth = (t) => (t = clamp01(t)) * t * (3 - 2 * t);
const span = (s, [a, b]) => clamp01((s - a) / (b - a));

/**
 * About → Featured Projects (timings in scene.js). The head office map fills the screen with the
 * head office in the middle; the About panel slides in from the right (from below the map's
 * part on a phone) as the map glides to keep the head office in the middle of what's left
 * ("See in 3D" swaps the map for the 3D map behind it). Then
 * a white panel grows out of the About panel to fill the screen while its content fades, and
 * the Featured Projects heading rises in on it. The stage is CSS-sticky, so at the end of the
 * scene the panel simply scrolls up and away, onto the clouds behind it.
 * Scrubbed by scroll, so it all reverses on the way back up. Writes transforms, opacity and
 * clip-path only, on scroll.
 */
export function init({ stage }) {
  const scene = $('[data-scene]');
  if (!scene) return;
  const panel = $('[data-scene-panel]', scene);
  const about = $('[data-scene-about]', scene);
  const card = $('[data-scene-card]', scene);
  const intro = $('[data-scene-intro]', scene);
  const toggle = $('[data-hq-toggle]', scene);
  const canvas = $('.hq__canvas', scene);
  const reduce = prefersReducedMotion();

  // how far the map glides as the panel comes in: the head office from the middle of the
  // screen to the middle of the part the panel leaves (left half, or the band above it)
  let pan = { x: 0, y: 0 };
  const measurePan = () => {
    const stageBox = scene.querySelector('.scene__stage').getBoundingClientRect();
    const narrow = card.offsetWidth >= stageBox.width - 1;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    pan = narrow ? { x: 0, y: stageBox.height / 2 - (header + card.offsetTop) / 2 } : { x: card.offsetWidth / 2, y: 0 };
  };

  // "See in 3D": fade the 2D map to show the 3D map behind it, already at the head office
  let in3d = false;
  let active = false;
  let grown = 0;
  let mapCovers = false;
  // with the 2D map up, the map and the panel cover the whole screen: the 3D map needn't draw
  const updateCover = () => {
    const on = active && grown < 1 && !in3d;
    if (on !== mapCovers) stage.setOccluded('about', (mapCovers = on));
  };
  toggle?.addEventListener('click', () => {
    in3d = !in3d;
    about.classList.toggle('is-3d', in3d);
    toggle.setAttribute('aria-pressed', String(in3d));
    $('[data-hq-toggle-label]', toggle).textContent = in3d ? 'Back to the map' : 'See HQ in 3D';
    updateCover();
  });

  // the card's place on the stage, as clip-path insets (px) from the stage's edges
  let from = null;
  const measure = () => {
    const s = scene.querySelector('.scene__stage').getBoundingClientRect();
    const c = card.getBoundingClientRect();
    from = { top: c.top - s.top, right: s.right - c.right, bottom: s.bottom - c.bottom, left: c.left - s.left };
  };

  let covered = false;
  const apply = (s) => {
    const grow = smooth(span(s, SCENE.expand));
    // measured as the panel starts to grow (the card may still be easing into place before)
    if (grow === 0) from = null;
    else if (!from) measure();
    const fade = span(s, SCENE.fade);
    const rise = smooth(span(s, SCENE.heading));

    panel.style.visibility = grow > 0 ? 'visible' : 'hidden';
    if (reduce) panel.style.opacity = grow.toFixed(3);
    else if (from) {
      const k = 1 - grow;
      panel.style.clipPath = `inset(${(from.top * k).toFixed(1)}px ${(from.right * k).toFixed(1)}px ${(from.bottom * k).toFixed(1)}px ${(from.left * k).toFixed(1)}px)`;
    }
    // the About panel slides in (fades in, with reduced motion) and the map glides with it
    const slide = smooth(span(s, SCENE.slide));
    if (reduce) card.style.transform = '';
    else {
      card.style.transform = `translate3d(${((1 - slide) * 100).toFixed(2)}%, 0, 0)`;
      canvas.style.transform = `translate3d(${(-pan.x * slide).toFixed(1)}px, ${(-pan.y * slide).toFixed(1)}px, 0)`;
    }
    card.style.visibility = slide > 0 ? 'visible' : 'hidden'; // off screen: its links aren't focusable
    // the panel's content fades; the map stays until the growing panel has covered it
    card.style.opacity = ((reduce ? slide : 1) * (1 - fade)).toFixed(3);
    about.style.visibility = grow >= 1 ? 'hidden' : 'visible'; // its links aren't focusable once gone
    grown = grow;
    updateCover();
    intro.style.opacity = rise.toFixed(3);
    intro.style.transform = reduce ? '' : `translate3d(0, ${lerp(48, 0, rise).toFixed(1)}px, 0)`;

    // while the panel fills the screen, the map underneath doesn't need drawing (not from the
    // end of the hold, when it starts to slide away)
    const full = grow >= 1 && s < SCENE.hold;
    if (full !== covered) stage.setOccluded('scene', (covered = full));
  };

  ScrollTrigger.create({
    trigger: scene,
    start: () => sceneScroll(scene, 0),
    end: () => sceneScroll(scene, SCENE.hold),
    onToggle: (self) => {
      active = self.isActive;
      updateCover();
    },
    onRefresh: (self) => {
      from = null;
      measurePan();
      apply(self.progress * SCENE.hold);
    },
    onUpdate: (self) => apply(self.progress * SCENE.hold),
  });
  measurePan();
  apply(0);
}
