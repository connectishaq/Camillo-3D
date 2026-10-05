import { fbm, rng } from './noise.js';

/*
 * Soft "smoke puff" cloud textures, as plain RGBA bytes (no DOM or Three.js, so they can be
 * made in a web worker). Layering many of these, each partly transparent, gives the photo-
 * real look of cloud: thin wispy edges, denser cores, white tops and soft grey undersides.
 */
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** One puff, S×S RGBA, rows bottom-up (as a DataTexture expects). */
export function puffPixels(seed, S = 256) {
  const r = rng(seed);
  // billowing shape: a few overlapping soft lumps, a little flatter underneath
  const lumps = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const u = (r() - 0.5) * 0.5;
    lumps.push({ x: 0.5 + u, y: 0.55 - r() * 0.16 * (1 - Math.abs(u) * 1.6), rad: 0.16 + r() * 0.12 });
  }
  const low = fbm(S, 3, 4, seed);
  const wisp = fbm(S, 8, 4, seed + 31);
  const fine = fbm(S, 24, 3, seed + 57);
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const i = y * S + x;
      let d = 0;
      for (const l of lumps) {
        const dx = u - l.x;
        const dy = (v - l.y) * (v > l.y ? 1.35 : 1); // flatter base
        d += Math.exp(-(dx * dx + dy * dy) / (l.rad * l.rad * 0.5));
      }
      // never touch the texture's border
      const edge = Math.min(u, 1 - u, v, 1 - v);
      d *= smooth(edge / 0.16);
      // smoky structure: large soft variation, wispy breakup, fine grain
      d *= 0.5 + 0.8 * low[i];
      d *= 0.2 + 1.15 * Math.pow(wisp[i], 1.4);
      d *= 0.82 + 0.36 * fine[i];
      const a = Math.pow(smooth((d - 0.1) / 0.75), 1.1);
      if (a <= 0.003) continue;
      // light from above: white crowns and cores (as bright as the wash behind, so the cover reads
      // as one bank, not spots), only the thickest undersides a touch grey
      // (shading follows density, not position, so overlapping puffs leave no bright arcs)
      const top = smooth((0.85 - v) / 0.7); // canvas y grows downwards
      const shade = 0.92 + 0.07 * top + 0.04 * wisp[i] - 0.05 * smooth((d - 0.9) / 1.2) * (1 - top);
      const o = ((S - 1 - y) * S + x) * 4;
      px[o] = 255 * Math.min(1, shade + 0.02);
      px[o + 1] = 255 * Math.min(1, shade + 0.03);
      px[o + 2] = 255 * Math.min(1, shade + 0.06);
      px[o + 3] = 255 * a;
    }
  }
  return px;
}
