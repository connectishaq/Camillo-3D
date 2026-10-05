import '../../features/clouds/clouds.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion, supportsWebGL } from '../../utils/dom.js';

/**
 * The Featured Projects heading sits on a curtain of cloud (features/clouds/CloudCurtain.js):
 *  - while the intro scrolls up, the bank thickens until it fills the screen behind the text;
 *  - once covered, the camera already flies to the first project, hidden behind it;
 *  - as the heading leaves, the curtain slides apart to the left and right, revealing it.
 * Scrubbed by scroll, so it reverses on the way back up.
 */
export function initIntroClouds({ stage, firstChapter }) {
  const intro = $('[data-chapter="projectsIntro"]');
  const host = $('[data-clouds]');
  if (!intro || !host) return;
  if (!supportsWebGL({ webgl2Only: true })) return document.body.classList.add('no-clouds');

  const state = { cover: 0, part: 0 };
  let curtain = null;
  // set up behind the loader (worker noise, texture upload, shader compile), never mid-scroll
  import('../../features/clouds/CloudCurtain.js')
    .then(async ({ CloudCurtain }) => {
      const c = new CloudCurtain(host, { reducedMotion: prefersReducedMotion() });
      await c.build();
      curtain = c;
      update();
    })
    .catch((err) => {
      console.warn('[clouds] unavailable:', err);
      document.body.classList.add('no-clouds');
    });

  let occluded = false;
  const update = () => {
    curtain?.set(state);
    // while the curtain fills the screen, the map underneath doesn't need drawing
    const hidden = !!curtain && state.cover > 0.995 && state.part < 0.02;
    if (hidden !== occluded) stage.setOccluded('clouds', (occluded = hidden));
    // behind the clouds: send the camera to the first project, so it's framed when they part
    if (state.cover > 0.97 && state.part < 0.6 && stage.current === 'projectsIntro') stage.go(firstChapter);
    else if (state.cover < 0.6 && stage.current === firstChapter) stage.go('projectsIntro');
  };

  // thickens while the intro rises from the bottom of the screen
  ScrollTrigger.create({
    trigger: intro,
    start: 'top 92%',
    end: 'top 15%',
    scrub: true,
    onUpdate: (self) => ((state.cover = self.progress), update()),
  });
  // slides apart as the heading leaves and the first project card arrives
  ScrollTrigger.create({
    trigger: intro,
    start: 'bottom 85%',
    end: 'bottom 15%',
    scrub: true,
    onUpdate: (self) => ((state.part = self.progress), update()),
  });
}
