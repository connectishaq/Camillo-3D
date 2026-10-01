import '../features/map/map.css';
import { prefersReducedMotion } from '../utils/dom.js';

/*
 * The fixed 3D map behind the story. Default: CityStory, the generated daytime Melbourne
 * (offline, no keys). Optional modes (VITE_MAP_MODE) try their stage first and fall back:
 *   'photoreal' — Google Photorealistic 3D Tiles → MapLibre → CityStory
 *   'map'       — MapLibre + OpenFreeMap tiles → CityStory
 *
 * Every stage is loaded on demand (its own chunk, with Three.js), so the page's own
 * script stays small. All stages share one interface:
 *   new Stage(container, { cameras, office, projects, reducedMotion, onReady, onFail, onPinClick, onProgress })
 *   .go(chapter, { duration }) · .pause() · .resume() · .destroy()
 */
const loadCity = () => import('../features/map/CityStory.js').then((m) => m.CityStory);
const loadMap = () => import('../features/map/MapStory.js').then((m) => m.MapStory);
const loadPhotoreal = () => import('../features/map/photoreal/PhotorealStory.js').then((m) => m.PhotorealStory);

/** Starts the map stage. Returns `{ go(chapter), pause(), resume() }`, usable straight away. */
export function startStage(container, { cameras, office, projects, loader, onPinClick }) {
  const reducedMotion = prefersReducedMotion();
  const state = { impl: null, current: 'hero' };
  // with reduced motion the camera cuts between chapters instead of flying
  const flight = reducedMotion ? { duration: 0 } : undefined;
  const options = {
    cameras,
    office,
    projects,
    reducedMotion,
    onPinClick,
    onReady: () => loader.done(),
    onProgress: (p) => loader.progress(p),
  };

  const chain = [];
  const mode = import.meta.env.VITE_MAP_MODE;
  if (mode === 'photoreal' && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) chain.push(['photoreal', loadPhotoreal]);
  if (mode === 'map' || mode === 'photoreal') chain.push(['map', loadMap]);
  chain.push(['city', loadCity]);

  const fail = (name, err) => {
    console.warn(`[${name}] unavailable:`, err);
    if (chain.length) return startNext();
    document.body.classList.add('no-map');
    loader.done();
  };

  const startNext = () => {
    const [name, load] = chain.shift();
    container.innerHTML = '';
    document.body.classList.remove('no-map');
    load()
      .then((Stage) => {
        let impl = null;
        let failed = false;
        impl = new Stage(container, {
          ...options,
          onFail: (reason) => {
            if (failed) return;
            failed = true;
            // deferred: a stage may fail from inside its own constructor
            queueMicrotask(() => {
              impl?.destroy?.();
              if (state.impl === impl) state.impl = null;
              container.innerHTML = '';
              fail(name, reason);
            });
          },
        });
        if (!failed) {
          state.impl = impl;
          impl.go(state.current, flight);
        }
      })
      .catch((err) => fail(name, err));
  };
  startNext();

  return {
    go(chapter) {
      state.current = chapter;
      state.impl?.go(chapter, flight);
    },
    pause: () => state.impl?.pause?.(),
    resume: () => state.impl?.resume?.(),
  };
}
