import './projects.css';
import { $$ } from '../../utils/dom.js';
import { initIntroClouds } from './intro-clouds.js';

/**
 * Project chapters: "Explore in 3D" opens the Building Explorer, and the intro sits in clouds
 * (intro-clouds.js).
 * `explorer` is the lazy launcher from app/explorer.js; hovering or focusing a button
 * starts downloading the explorer code so the click opens it straight away.
 */
export function init({ projects, explorer, stage }) {
  initIntroClouds({ stage });

  $$('[data-explore]').forEach((btn) => {
    const project = projects.find((p) => p.slug === btn.dataset.explore);
    btn.addEventListener('click', () => {
      btn.focus({ preventScroll: true }); // Safari doesn't focus clicked buttons; focus returns here on close
      explorer.open(project);
    });
    btn.addEventListener('pointerenter', explorer.preload, { once: true });
    btn.addEventListener('focus', explorer.preload, { once: true });
  });
}
