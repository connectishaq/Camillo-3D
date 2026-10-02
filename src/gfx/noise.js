/*
 * Seeded noise helpers, free of DOM and Three.js so they also run in web workers.
 */

/** Seeded PRNG (mulberry32). */
export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise, `cells` lattice cells across, returns size×size floats in 0–1. */
export function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const lat = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy);
    const ty = sm(fy - y0);
    const ya = y0 % cells;
    const yb = (y0 + 1) % cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx);
      const tx = sm(fx - x0);
      const xa = x0 % cells;
      const xb = (x0 + 1) % cells;
      const a = lat[ya * cells + xa] + (lat[ya * cells + xb] - lat[ya * cells + xa]) * tx;
      const b = lat[yb * cells + xa] + (lat[yb * cells + xb] - lat[yb * cells + xa]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Fractal (fBm) tileable noise in 0–1. */
export function fbm(size, baseCells, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, baseCells << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
