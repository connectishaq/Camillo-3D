import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $ } from '../../utils/dom.js';

/**
 * The Featured Projects intro sits above a sea of cloud (features/map/city/cloudsea.js):
 * the bank builds up over the city as the intro scrolls in, the heading sits over it, and it
 * thins out and burns off as the visitor scrolls on to the first project. Scrubbed by scroll,
 * so it reverses on the way back up.
 */
export function initIntroClouds({ stage }) {
  const intro = $('[data-chapter="projectsIntro"]');
  if (!intro) return;
  const state = { gather: 0, clear: 0 };
  const update = () => stage.setClouds(smooth(state.gather) * (1 - smooth(state.clear)));

  // builds up while the intro rises from the bottom of the screen
  ScrollTrigger.create({
    trigger: intro,
    start: 'top 95%',
    end: 'top 20%',
    scrub: true,
    onUpdate: (self) => ((state.gather = self.progress), update()),
  });
  // clears as the heading leaves and the first project arrives
  ScrollTrigger.create({
    trigger: intro,
    start: 'bottom 75%',
    end: 'bottom 5%',
    scrub: true,
    onUpdate: (self) => ((state.clear = self.progress), update()),
  });
}

const smooth = (t) => t * t * (3 - 2 * t);
