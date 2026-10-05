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
export function initIntroClouds() {
  const scene = $('[data-scene]');
  const host = $('[data-clouds]');
  if (!scene || !host) return;

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
