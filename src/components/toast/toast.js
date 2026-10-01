import './toast.css';

const VISIBLE_MS = 2600;
let el;
let timer;

/** Short status message at the bottom of the screen (announced to screen readers). */
export function toast(message) {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-visible'), VISIBLE_MS);
}
