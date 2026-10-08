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
 * "Explore in 3D" (the hero's link, [data-enter-3d]): into the 3D city through the clouds,
 * with no visible cut. The screen fades into a cloud mist; behind it the page moves into the
 * full bank of cloud (the Featured Projects panel already gone, the camera heading for the
 * skyline); the mist thins to show the clouds all round; then the page glides on as they part
 * onto the skyline. Without JS the link just goes to the skyline chapter (#explore); with
 * reduced motion it cuts straight to the skyline.
 */
function initEnter(scene, scroll) {
  const reduce = prefersReducedMotion();
  let busy = false;
  const mist = document.createElement('div');
  mist.className = 'clouds-mist';
  mist.setAttribute('aria-hidden', 'true');
  document.body.append(mist);
  const fade = (from, to, duration, easing) =>
    mist.animate([{ opacity: from }, { opacity: to }], { duration, easing, fill: 'forwards' }).finished;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  document.querySelectorAll('[data-enter-3d]').forEach((link) =>
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      if (busy) return;
      const into = sceneScroll(scene, SCENE.part[0] - 5); // in the clouds, just before they part
      const out = sceneScroll(scene, SCENE.part[1] + 10); // past them, over the skyline
      if (reduce) return scroll.scrollTo(out, { immediate: true });
      busy = true;
      mist.classList.add('is-on');
      await fade(0, 1, 700, 'cubic-bezier(0.55, 0, 0.75, 0.3)'); // into the mist
      scroll.scrollTo(into, { immediate: true });
      await frame(); // the clouds laid out at full cover behind the mist
      const clear = fade(1, 0, 1100, 'cubic-bezier(0.25, 0.6, 0.3, 1)'); // the clouds all round
      await new Promise((r) => setTimeout(r, 650));
      scroll.scrollTo(out, { duration: 3.4, easing: (t) => 1 - Math.pow(1 - t, 3) }); // through them
      await clear;
      mist.classList.remove('is-on');
      busy = false;
    }),
  );
}
