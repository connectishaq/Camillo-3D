import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/explorer.css';

import Lenis from 'lenis';
import gsap from 'gsap';

import { company, cameras, office, projects, moreProjects } from './data/site.js';
import { renderContent } from './modules/content.js';
import { CityStory } from './modules/city/CityStory.js';
import { initChapters } from './modules/chapters.js';
import { Explorer } from './modules/explorer/Explorer.js';
import { initLoader, initHeader, toast } from './modules/ui.js';
import { hasGLB, loadGLB } from './modules/explorer/glb.js';

renderContent({ company, projects, moreProjects });

// Time-accurate tweens: keeps camera moves in sync even when a frame is slow.
gsap.ticker.lagSmoothing(0);

/* Smooth scroll */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = new Lenis({ lerp: reduceMotion ? 1 : 0.085, smoothWheel: !reduceMotion });
const raf = (t) => {
  lenis.raf(t);
  requestAnimationFrame(raf);
};
requestAnimationFrame(raf);
const scrollTo = (target) => lenis.scrollTo(target, { offset: 0, duration: 1.6 });

document.querySelectorAll('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    scrollTo(target);
  }),
);

/* 3D building explorer */
const explorer = new Explorer(document.querySelector('[data-explorer]'), {
  onOpen: () => {
    lenis.stop();
    stage.impl?.pause?.();
  },
  onClose: () => {
    lenis.start();
    stage.impl?.resume?.();
  },
});
const openProject = (p) => explorer.open(p);
if (import.meta.env.DEV) window.__explorer = explorer; // debugging handle (dev only)

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-explore]');
  if (btn) openProject(projects.find((p) => p.slug === btn.dataset.explore));
  const soon = e.target.closest('[data-soon]');
  if (soon) {
    e.preventDefault();
    toast('Individual project pages are the next build phase.');
  }
});

/* Map + scroll story. Default: CityStory, the generated daytime Melbourne (offline,
 * no keys). Optional modes (VITE_MAP_MODE) try their stage first and fall back:
 *   'photoreal' — Google Photorealistic 3D Tiles → MapLibre → CityStory
 *   'map'       — MapLibre + OpenFreeMap tiles → CityStory */
const loader = initLoader();
const stageEl = document.getElementById('map');
const stage = {
  impl: null,
  current: 'hero',
  go(chapter) {
    this.current = chapter;
    this.impl?.go(chapter);
  },
};
const storyOptions = {
  cameras,
  office,
  projects,
  onPinClick: openProject,
  onReady: () => loader.done(),
  onProgress: (p) => loader.progress(p),
};

const startCity = () => {
  stageEl.innerHTML = '';
  document.body.classList.remove('no-map');
  try {
    stage.impl = new CityStory(stageEl, storyOptions);
    stage.impl.go(stage.current);
  } catch (err) {
    console.warn('[city] unavailable:', err);
    document.body.classList.add('no-map');
    loader.done();
  }
};

const chain = [];
const mode = import.meta.env.VITE_MAP_MODE;
if (mode === 'photoreal' && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  chain.push(['photoreal', () => import('./modules/photoreal/PhotorealStory.js').then((m) => m.PhotorealStory)]);
}
if (mode === 'map' || mode === 'photoreal') {
  chain.push(['map', () => import('./modules/map-story.js').then((m) => m.MapStory)]);
}

// Path A models: preload any public/models/<slug>.glb so the explorer and city can use them
projects.forEach((p) => hasGLB(p.slug) && loadGLB(p.slug, p.model));

const startNext = () => {
  const step = chain.shift();
  if (!step) return startCity();
  const [name, load] = step;
  load()
    .then((Story) => {
      let impl = null;
      let failed = false;
      impl = new Story(stageEl, {
        ...storyOptions,
        onFail: (reason) => {
          if (failed) return;
          failed = true;
          console.warn(`[${name}] unavailable (${reason}), falling back`);
          // deferred: a story may fail from inside its own constructor
          queueMicrotask(() => {
            impl?.destroy?.();
            if (stage.impl === impl) stage.impl = null;
            stageEl.innerHTML = '';
            startNext();
          });
        },
      });
      if (!failed) {
        stage.impl = impl;
        impl.go(stage.current);
      }
    })
    .catch((err) => {
      console.warn(`[${name}] failed to load:`, err);
      startNext();
    });
};
startNext();

initChapters({
  scrollTo,
  onChange: (chapter) => stage.go(chapter),
});
initHeader();

/* Hero intro */
loader.finished.then(() => {
  gsap.fromTo('.hero [data-reveal]', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.3, ease: 'power3.out', stagger: 0.12 });
});
