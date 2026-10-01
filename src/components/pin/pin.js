import './pin.css';
import { escapeHtml } from '../../utils/escape.js';

/**
 * Map pin: a brass dot and a label. `hq` gets the diamond marker.
 * Pins sit inside the decorative (aria-hidden) map stage, so they're mouse/touch only;
 * keyboard and screen-reader users get the same actions from the story cards.
 */
export function createPin({ label, hq = false, onClick }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.tabIndex = -1;
  el.className = hq ? 'pin pin--hq' : 'pin';
  el.innerHTML = `<span class="pin__dot"></span><span class="pin__label">${escapeHtml(label)}</span>`;
  el.addEventListener('click', onClick);
  return el;
}
