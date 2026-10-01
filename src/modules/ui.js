/** Small UI helpers: loader, header state, toast. */

export function initLoader() {
  const el = document.querySelector('[data-loader]');
  const bar = document.querySelector('[data-loader-bar]');
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
  // never trap the visitor behind the loader
  setTimeout(done, 9000);
  return { done, finished, progress: setProgress };
}

export function initHeader() {
  const header = document.querySelector('[data-header]');
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

let toastEl;
export function toast(message) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
}
