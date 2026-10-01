import './locator.css';

/** Live location readout. Returns `{ set(text) }`. */
export function createLocator(el = document.querySelector('[data-locator-text]')) {
  return {
    set(text) {
      el.textContent = text;
    },
  };
}
