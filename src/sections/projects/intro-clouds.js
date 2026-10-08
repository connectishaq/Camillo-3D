import '../../features/clouds/clouds.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion } from '../../utils/dom.js';
import { SCENE, sceneScroll } from '../about/scene.js';

/**
 * The cloud bank behind the Featured Projects panel (features/clouds/CloudCurtain.js), timed
 * from the About → Featured Projects scene (sections/about/scene.js):
 *  - while the panel fills the screen, the bank thickens behind it to full cover;
 *  - the panel slides up onto it;
 *  - on the next scroll it slides apart to the left and right onto the skyline (the camera
 *    went there while the panel covered the map); the skyline chapter, then the projects,
 *    take over from there.
 * Scrubbed by scroll, so it reverses on the way back up.
 */
export function initIntroClouds({ scroll } = {}) {
  const scene = $('[data-scene]');
  const host = $('[data-clouds]');
  if (!scene || !host) return;
  if (scroll) initEnter(scene, scroll);

  const state = { cover: 0, part: 0 };
  let curtain = null;
  // set up behind the loader (images decoded up front), never mid-scroll
  import('../../features/clouds/CloudCurtain.js')
    .then(async ({ CloudCurtain }) => {
      const c = new CloudCurtain(host, { reducedMotion: prefersReducedMotion() });
      await c.build();
      curtain = c;
      curtain.set(state);
    })
    .catch((err) => console.warn('[clouds] unavailable:', err));

  const scrub = (key, [from, to]) =>
    ScrollTrigger.create({
      trigger: scene,
      start: () => sceneScroll(scene, from),
      end: () => sceneScroll(scene, to),
      scrub: true,
      onUpdate: (self) => {
        state[key] = self.progress;
        curtain?.set(state);
      },
    });
  scrub('cover', SCENE.cover);
  scrub('part', SCENE.part);
}

/**
 * "Explore in 3D" (the hero's link, [data-enter-3d]): straight into the 3D city through the
 * clouds. It cuts to the full bank of cloud (the Featured Projects panel already gone), where
 * the camera starts flying to the skyline behind it, then glides on as the clouds part onto it.
 * Without JS the link just goes to the skyline chapter (#explore).
 */
function initEnter(scene, scroll) {
  const reduce = prefersReducedMotion();
  let timer = 0;
  document.querySelectorAll('[data-enter-3d]').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      clearTimeout(timer);
      const into = sceneScroll(scene, SCENE.part[0] - 5); // in the clouds, just before they part
      const out = sceneScroll(scene, SCENE.part[1] + 10); // past them, over the skyline
      if (reduce) return scroll.scrollTo(out, { immediate: true });
      scroll.scrollTo(into, { immediate: true });
      // a moment in the clouds (they gather round), then slowly through them
      timer = setTimeout(() => scroll.scrollTo(out, { duration: 3.6, easing: (t) => 1 - Math.pow(1 - t, 3) }), 1400);
    }),
  );
}
