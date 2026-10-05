import '../../features/clouds/clouds.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, prefersReducedMotion } from '../../utils/dom.js';

/**
 * The Featured Projects heading sits on a curtain of cloud (features/clouds/CloudCurtain.js):
 *  - while the intro scrolls up, the bank thickens until it fills the screen behind the text;
 *  - once covered, the camera moves to the skyline view, hidden behind it;
 *  - as the heading leaves, the curtain slides apart to the left and right onto the skyline;
 *    the next chapter (skyline), then the projects, take over from there.
 * Scrubbed by scroll, so it reverses on the way back up.
 */
export function initIntroClouds({ stage, reveal = 'skyline' }) {
  const intro = $('[data-chapter="projectsIntro"]');
  const host = $('[data-clouds]');
  if (!intro || !host) return;

  const state = { cover: 0, part: 0 };
  let curtain = null;
  // set up behind the loader (images decoded up front), never mid-scroll
  import('../../features/clouds/CloudCurtain.js')
    .then(async ({ CloudCurtain }) => {
      const c = new CloudCurtain(host, { wash: intro.querySelector('.intro'), reducedMotion: prefersReducedMotion() });
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
    // behind the clouds: move the camera to the skyline, so that's what they part onto
    if (state.cover > 0.97 && state.part < 0.6 && stage.current === 'projectsIntro') stage.go(reveal);
    else if (state.cover < 0.6 && stage.current === reveal) stage.go('projectsIntro');
  };

  // thickens while the intro rises from the bottom of the screen
  ScrollTrigger.create({
    trigger: intro,
    start: 'top 92%',
    end: 'top 15%',
    scrub: true,
    onUpdate: (self) => ((state.cover = self.progress), update()),
  });
  // slides apart once the heading has moved into the upper part of the screen (timed from the
  // heading, not the section, so it's the same on every layout)
  ScrollTrigger.create({
    trigger: intro.querySelector('.intro') || intro,
    start: 'bottom 50%',
    end: () => `+=${window.innerHeight * 0.75}`,
    scrub: true,
    onUpdate: (self) => ((state.part = self.progress), update()),
  });
}
