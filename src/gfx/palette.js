import * as THREE from 'three';

/*
 * Colours for the WebGL scenes, read from the design tokens in styles/tokens.css
 * (`--brand`, `--bg`, `--map-*`), so the city, the explorer and the page share one source.
 * Read lazily, once the stylesheet has applied (the 3D modules load after the page).
 */
const TOKENS = {
  brand: '--brand',
  bg: '--bg',
  sky: '--map-sky',
  ground: '--map-ground',
  footpath: '--map-footpath',
  road: '--map-road',
  park: '--map-park',
  sand: '--map-sand',
  track: '--map-track',
  water: '--map-water',
  building: '--map-building',
  buildingWarm: '--map-building-warm',
  roof: '--map-roof',
  glass: '--map-glass',
  tree: '--map-tree',
  trunk: '--map-trunk',
  sun: '--map-sun',
  skyLight: '--map-sky-light',
  groundLight: '--map-ground-light',
  windowLit: '--map-window-lit',
  highlight: '--map-highlight',
  highlightHot: '--map-highlight-hot',
};

let cache;

/** `{ brand, bg, ground, water, … }` as hex strings. */
export function palette() {
  if (cache) return cache;
  const style = getComputedStyle(document.documentElement);
  cache = {};
  for (const [key, name] of Object.entries(TOKENS)) {
    const value = style.getPropertyValue(name).trim();
    if (!value) console.warn(`[palette] design token ${name} is not set`);
    cache[key] = value || '#808080';
  }
  return cache;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Shade variations of a token colour, worked out in sRGB (as designers read colours).
 * Each entry is a lightness offset, or [lightness, saturation] offsets.
 */
export function variants(hex, offsets) {
  const hsl = {};
  new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
  return offsets.map((o) => {
    const [l, s = 0] = Array.isArray(o) ? o : [o];
    const c = new THREE.Color().setHSL(hsl.h, clamp01(hsl.s + s), clamp01(hsl.l + l), THREE.SRGBColorSpace);
    return `#${c.getHexString(THREE.SRGBColorSpace)}`;
  });
}

/** One token colour shifted in lightness (and saturation). */
export const shade = (hex, l, s = 0) => variants(hex, [[l, s]])[0];

/** Mix two token colours in sRGB (t = 0 → a, 1 → b). */
export function mix(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** sRGB 0–255 components of a token colour (for canvas textures). */
export function rgb(hex) {
  const t = {};
  new THREE.Color(hex).getRGB(t, THREE.SRGBColorSpace);
  return [t.r, t.g, t.b].map((v) => Math.round(v * 255));
}
