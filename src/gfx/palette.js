import * as THREE from 'three';

/*
 * Colours for the WebGL scenes that follow the brand, read from the design tokens in
 * styles/tokens.css (`--brand`, `--bg`, `--map-*`): the explorer scene, map mode and site highlights.
 * Read lazily, once the stylesheet has applied (the 3D modules load after the page).
 */
const TOKENS = {
  brand: '--brand',
  bg: '--bg',
  sky: '--map-sky',
  ground: '--map-ground',
  building: '--map-building',
  sun: '--map-sun',
  skyLight: '--map-sky-light',
  groundLight: '--map-ground-light',
  windowLit: '--map-window-lit',
  highlight: '--map-highlight',
  highlightHot: '--map-highlight-hot',
  cloudLight: '--cloud-light',
  cloudWarm: '--cloud-warm',
  cloudShade: '--cloud-shade',
  cloudSkyTop: '--cloud-sky-top',
  cloudSkyBottom: '--cloud-sky-bottom',
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
