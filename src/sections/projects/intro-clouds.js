import '../../features/clouds/clouds.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion, supportsWebGL } from '../../utils/dom.js';

/**
 * The Featured Projects intro sits in a bank of clouds:
 *  - while the intro scrolls up, the clouds roll in until they fill the view;
 *  - once covered, the camera already flies to the first project (hidden in the clouds);
 *  - as the heading leaves, the clouds part sideways and the first project appears.
 * Everything is scrubbed by scroll, so it reverses when scrolling back up.
 * The cloud renderer is set up behind the loader (features/clouds/CloudLayer.js).
 */
export function initIntroClouds({ stage, firstChapter }) {
  const intro = $('[data-chapter="projectsIntro"]');
  const host = $('[data-clouds]');
  if (!intro || !host) return;
  if (!supportsWebGL()) return document.body.classList.add('no-clouds');

  const state = { cover: 0, part: 0 };
  let layer = null;
  let loading = null;
  const load = () =>
    (loading ??= import('../../features/clouds/CloudLayer.js')
      .then(async ({ CloudLayer }) => {
        const l = new CloudLayer(host, { reducedMotion: prefersReducedMotion() });
        await l.build();
        layer = l;
        layer.set(state);
      })
      .catch((err) => {
        console.warn('[clouds] unavailable:', err);
        document.body.classList.add('no-clouds');
      }));
  // set up while the loader still covers the page (WebGL context, texture upload, shader
  // compile), so none of that one-off work lands while the visitor is scrolling
  load();

  let occluded = false;
  const update = () => {
    layer?.set(state);
    // while the clouds fill the screen, the map underneath doesn't need drawing
    const hidden = !!layer && state.cover > 0.995 && state.part < 0.01;
    if (hidden !== occluded) stage.setOccluded((occluded = hidden));
    // fully in the clouds: have the camera at the first project, so it's framed when they part
    // (re-asserted, because scrolling back up re-activates the intro chapter)
    if (state.cover > 0.97 && state.part < 0.6 && stage.current === 'projectsIntro') stage.go(firstChapter);
    // back out above the clouds: the intro's own view again
    else if (state.cover < 0.6 && stage.current === firstChapter) stage.go('projectsIntro');
  };

  // roll in while the intro rises from the bottom of the screen
  ScrollTrigger.create({
    trigger: intro,
    start: 'top 92%',
    end: 'top 12%',
    scrub: true,
    onEnter: load,
    onUpdate: (self) => {
      state.cover = self.progress;
      update();
    },
  });
  // part as the heading leaves and the first project card arrives
  ScrollTrigger.create({
    trigger: intro,
    start: 'bottom 88%',
    end: 'bottom 30%',
    scrub: true,
    onUpdate: (self) => {
      state.part = self.progress;
      update();
    },
  });
}
