const LOGO_URL = `${import.meta.env.BASE_URL}brand/google-maps-logo.svg`;

/**
 * Google Maps Platform attribution, required for Photorealistic 3D Tiles:
 * the Google Maps logo plus the aggregated copyright line of the tiles currently on
 * screen, along the bottom of the map. Lives on <body> so story cards never cover it.
 * https://developers.google.com/maps/documentation/tile/policies
 */
export class Attribution {
  constructor() {
    const el = document.createElement('div');
    el.className = 'map-credits';
    el.innerHTML = `<img class="map-credits__logo" src="${LOGO_URL}" alt="Google Maps" width="86" height="18" /><span class="map-credits__text"></span>`;
    document.body.appendChild(el);
    this.el = el;
    this.text = el.querySelector('.map-credits__text');
    this.value = '';
  }

  /** Pull attributions from the renderer; tokens are de-duplicated, most frequent first. */
  update(tiles) {
    const seen = new Set();
    tiles.getAttributions().forEach((a) => {
      if (a.type !== 'string' || !a.value) return;
      a.value.split(';').forEach((t) => {
        const s = t.trim();
        if (s) seen.add(s);
      });
    });
    const value = [...seen].join('; ');
    if (value === this.value) return;
    this.value = value;
    this.text.textContent = value;
    this.el.title = value;
  }

  destroy() {
    this.el.remove();
  }
}
