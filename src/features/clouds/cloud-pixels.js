import { fbm, rng } from '../../gfx/noise.js';

/*
 * Cloud textures, as plain pixel arrays: no DOM or Three.js, so they can be generated in a
 * web worker (cloud-textures.worker.js) without blocking scrolling.
 */
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/**
 * One cumulus cloud as RGBA pixels (rows bottom-up, as a DataTexture expects). A cauliflower form (big core blobs along a flat base, layers
 * of smaller bumps on top) with crisp edges and a little wispy fringe, shaded by self-shadowing:
 * each point is darkened by the cloud between it and the sun (upper left), which gives the
 * bright billows and grey bellies of a real cumulus.
 */
export function cloudPixels(seed, { light: L, warm: W, shade: Sh }, S = 256) {
  const r = rng(seed);
  const baseY = S * 0.7;
  const blobs = [];
  for (let i = 0; i < 5; i++)
    blobs.push({ x: S * (0.3 + 0.4 * (i / 4) + (r() - 0.5) * 0.06), y: baseY - S * (0.08 + r() * 0.06), rad: S * (0.13 + r() * 0.05) });
  // bumps grow on the upper side of existing blobs: the billowing crown
  for (const [count, k] of [
    [16, 0.64],
    [16, 0.48],
  ]) {
    for (let i = 0; i < count; i++) {
      const parent = blobs[Math.floor(r() * blobs.length)];
      const a = Math.PI * (1.08 + r() * 0.84); // upper half (canvas y grows downwards)
      const rad = parent.rad * k * (0.8 + r() * 0.4);
      const x = parent.x + Math.cos(a) * parent.rad * 0.9;
      const y = Math.min(baseY - rad * 0.6, parent.y + Math.sin(a) * parent.rad * 0.9);
      if (x > S * 0.14 && x < S * 0.86 && y > S * 0.14) blobs.push({ x, y, rad });
    }
  }
  // density: compact smooth kernels, accumulated per blob over its bounding box only
  const D = new Float32Array(S * S);
  for (const b of blobs) {
    const x0 = Math.max(0, Math.floor(b.x - b.rad));
    const x1 = Math.min(S - 1, Math.ceil(b.x + b.rad));
    const y0 = Math.max(0, Math.floor(b.y - b.rad));
    const y1 = Math.min(S - 1, Math.ceil(b.y + b.rad));
    const r2 = b.rad * b.rad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / r2;
        if (q < 1) D[y * S + x] += (1 - q) * (1 - q);
      }
    }
  }
  const detail = fbm(S, 6, 5, seed);
  const fine = fbm(S, 24, 3, seed + 7);
  for (let y = 0; y < S; y++) {
    const flat = smooth((baseY + S * 0.035 - y) / (S * 0.05)); // flattish base
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      D[i] *= flat * (0.7 + 0.6 * detail[i]); // noise breaks up the outline
    }
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : D[(y | 0) * S + (x | 0)]);
  const px = new Uint8ClampedArray(S * S * 4);
  const step = S * 0.022;
  const lx = -0.5 * step;
  const ly = -0.87 * step;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const d = D[i];
      const o = ((S - 1 - y) * S + x) * 4; // flipped row
      // crisp body plus a soft, noisy fringe
      const a = Math.max(smooth((d - 0.26) / 0.16), 0.35 * smooth((d - 0.1) / 0.16) * fine[i]);
      if (a <= 0.002) continue;
      // self-shadow: cloud density towards the sun
      let occ = 0;
      for (let k = 1; k <= 7; k++) occ += at(x + lx * k, y + ly * k);
      const sun = Math.exp(-occ * 0.3);
      const ambient = 0.35 + 0.3 * clamp01(1 - (y - S * 0.2) / (baseY - S * 0.2)); // brighter higher up
      const lit = clamp01(ambient * 0.5 + sun * 0.85 + (detail[i] - 0.5) * 0.1);
      const warmth = Math.pow(sun, 3) * 0.8; // sunlit rims pick up a warm tint
      for (let ch = 0; ch < 3; ch++) {
        const base = Sh[ch] + (L[ch] - Sh[ch]) * lit;
        px[o + ch] = base + (W[ch] - base) * warmth * 0.5;
      }
      px[o + 3] = a * 255;
    }
  }
  return px;
}
