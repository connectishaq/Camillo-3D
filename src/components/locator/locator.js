/** Live location readout, for screen readers only (locator.html). Returns `{ set(text) }`. */
export function createLocator(el = document.querySelector('[data-locator-text]')) {
  return {
    set(text) {
      el.textContent = text;
    },
  };
}
