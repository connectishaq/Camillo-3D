import './about.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion } from '../../utils/dom.js';
import { lerp } from '../../utils/math.js';
import { SCENE, sceneScroll } from './scene.js';

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const smooth = (t) => (t = clamp01(t)) * t * (3 - 2 * t);
const span = (s, [a, b]) => clamp01((s - a) / (b - a));

/**
 * About → Featured Projects (timings in scene.js). The About card holds, then a panel the
 * colour of the card grows out of it to fill the screen while the card's content fades, and
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
  const reduce = prefersReducedMotion();

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
      const r = 20 * k; // the card's corner radius, squaring off as it fills the screen
      panel.style.clipPath = `inset(${(from.top * k).toFixed(1)}px ${(from.right * k).toFixed(1)}px ${(from.bottom * k).toFixed(1)}px ${(from.left * k).toFixed(1)}px round ${r.toFixed(1)}px)`;
    }
    about.style.opacity = (1 - fade).toFixed(3);
    about.style.visibility = fade >= 1 ? 'hidden' : 'visible'; // its link isn't focusable once gone
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
    onRefresh: (self) => {
      from = null;
      apply(self.progress * SCENE.hold);
    },
    onUpdate: (self) => apply(self.progress * SCENE.hold),
  });
  apply(0);
}
