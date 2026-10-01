import './loader.css';

/** Never trap the visitor behind the loader. */
const MAX_WAIT = 9000;

/**
 * Loader overlay. Creeps forward on its own until the map reports real progress.
 * Returns `{ progress(p), done(), finished }`; `finished` resolves once it has faded out.
 */
export function createLoader(el = document.querySelector('[data-loader]')) {
  const bar = el.querySelector('[data-loader-bar]');
  let progress = 0;
  let resolve;
  const finished = new Promise((r) => (resolve = r));
  const timer = setInterval(() => {
    progress = Math.min(progress + Math.random() * 12, 88);
    bar.style.width = `${progress}%`;
  }, 180);

  let isDone = false;
  const done = () => {
    if (isDone) return;
    isDone = true;
    clearInterval(timer);
    bar.style.width = '100%';
    setTimeout(() => {
      el.classList.add('is-done');
      resolve();
    }, 350);
  };
  /** Real progress (0–1) from the map; replaces the simulated creep. Never moves backwards. */
  const setProgress = (p) => {
    if (isDone) return;
    clearInterval(timer);
    progress = Math.max(progress, Math.min(100, p * 100));
    bar.style.width = `${progress}%`;
  };
  setTimeout(done, MAX_WAIT);
  return { done, finished, progress: setProgress };
}
