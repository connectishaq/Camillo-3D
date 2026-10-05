import { rng } from './noise.js';

/*
 * Tileable 3D cloud noise as plain RGBA bytes (N³), free of DOM and Three.js so it can be
 * generated in a web worker:
 *   r = Perlin–Worley: big, cauliflower-like billows
 *   g = Worley fBm at a higher frequency: the erosion detail for wispy edges
 * Each channel is stretched to the full 0–255 range.
 */
export function cloudNoiseData(N = 64) {
  const worley = makeWorley();
  const value = makeValueNoise(N);
  const data = new Uint8Array(N * N * N * 4);
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const w = z / N;
        const wf = 0.625 * worley(u, v, w, 4) + 0.25 * worley(u, v, w, 8) + 0.125 * worley(u, v, w, 16);
        const pf = 0.5 * value(u, v, w, 4) + 0.3 * value(u, v, w, 8) + 0.2 * value(u, v, w, 16);
        const pw = remap(pf, wf - 1, 1, 0, 1); // Perlin–Worley
        const detail = 0.625 * worley(u, v, w, 8) + 0.25 * worley(u, v, w, 16) + 0.125 * worley(u, v, w, 32);
        const i = ((z * N + y) * N + x) * 4;
        data[i] = clamp255(pw);
        data[i + 1] = clamp255(detail);
        data[i + 3] = 255;
      }
    }
  }
  // stretch each channel to the full 0–255 range, so coverage thresholds have contrast
  for (const ch of [0, 1]) {
    let lo = 255;
    let hi = 0;
    for (let i = ch; i < data.length; i += 4) {
      lo = Math.min(lo, data[i]);
      hi = Math.max(hi, data[i]);
    }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = ch; i < data.length; i += 4) data[i] = (data[i] - lo) * k;
  }
  return data;
}

const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Inverted, tileable Worley noise: 1 at feature points, 0 far from them. */
function makeWorley() {
  const cache = new Map();
  const points = (cells) => {
    if (cache.has(cells)) return cache.get(cells);
    const r = rng(1117 * cells);
    const p = new Float32Array(cells * cells * cells * 3).map(() => r());
    cache.set(cells, p);
    return p;
  };
  return (u, v, w, cells) => {
    const p = points(cells);
    const fx = u * cells;
    const fy = v * cells;
    const fz = w * cells;
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    const cz = Math.floor(fz);
    let best = 9;
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ix = (cx + dx + cells) % cells;
          const iy = (cy + dy + cells) % cells;
          const iz = (cz + dz + cells) % cells;
          const k = ((iz * cells + iy) * cells + ix) * 3;
          const ex = cx + dx + p[k] - fx;
          const ey = cy + dy + p[k + 1] - fy;
          const ez = cz + dz + p[k + 2] - fz;
          const d = ex * ex + ey * ey + ez * ez;
          if (d < best) best = d;
        }
    return 1 - Math.min(1, Math.sqrt(best));
  };
}

/** Tileable 3D value noise (smooth trilinear lattice). */
function makeValueNoise() {
  const cache = new Map();
  const lattice = (cells) => {
    if (cache.has(cells)) return cache.get(cells);
    const r = rng(7919 * cells);
    const l = new Float32Array(cells * cells * cells).map(() => r());
    cache.set(cells, l);
    return l;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v, w, cells) => {
    const l = lattice(cells);
    const fx = u * cells;
    const fy = v * cells;
    const fz = w * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const z0 = Math.floor(fz);
    const tx = sm(fx - x0);
    const ty = sm(fy - y0);
    const tz = sm(fz - z0);
    const at = (x, y, z) => l[((z % cells) * cells + (y % cells)) * cells + (x % cells)];
    const lerp = (a, b, t) => a + (b - a) * t;
    const c00 = lerp(at(x0, y0, z0), at(x0 + 1, y0, z0), tx);
    const c10 = lerp(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), tx);
    const c01 = lerp(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), tx);
    const c11 = lerp(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), tx);
    return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
  };
}
