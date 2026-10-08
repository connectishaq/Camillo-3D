import * as THREE from 'three';

/*
 * Procedural textures, generated on a canvas at runtime: no image downloads, so the
 * city and the explorer work offline and in the single-file preview build.
 * Everything tiles seamlessly. Results are cached by key.
 */

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// noise helpers live in noise.js (dependency-free, so web workers can use them too)
export { rng, valueNoise, fbm } from './noise.js';
import { rng, fbm } from './noise.js';

const hexToRgb = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

function toTexture(c, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; // crisp at grazing angles (slabs and ground seen edge-on)
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/** Paints `height` (0–1 floats) into an RGB canvas tinted by `hex`; returns { color, bump } canvases. */
function paint(size, height, hex, contrast = 0.35, noise = null, noiseAmt = 0.08) {
  const [r, g, b] = hexToRgb(hex);
  const col = canvas(size);
  const bmp = canvas(size);
  const cc = col.getContext('2d');
  const bc = bmp.getContext('2d');
  const ci = cc.createImageData(size, size);
  const bi = bc.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const h = height[i];
    const n = noise ? (noise[i] - 0.5) * noiseAmt * 2 : 0;
    const k = 1 - contrast + contrast * h * 2 + n;
    ci.data[i * 4] = Math.min(255, r * k);
    ci.data[i * 4 + 1] = Math.min(255, g * k);
    ci.data[i * 4 + 2] = Math.min(255, b * k);
    ci.data[i * 4 + 3] = 255;
    const v = Math.max(0, Math.min(255, h * 255));
    bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = v;
    bi.data[i * 4 + 3] = 255;
  }
  cc.putImageData(ci, 0, 0);
  bc.putImageData(bi, 0, 0);
  return { col, bmp };
}

/* ------------------------------------------------------------------ */
/* Architectural material textures (explorer + project models)         */
/* ------------------------------------------------------------------ */

/**
 * Real-world size (metres) of one texture tile per façade system.
 * UVs are authored in metres, so `repeat = 1 / tile`.
 */
export const SYSTEM_TILE = {
  brick: 1.2,
  precast: 3,
  'board-concrete': 2.4,
  concrete: 3,
  render: 2,
  timber: 1.8,
  stone: 3,
  travertine: 3,
  metal: 2.4,
  'glass-curtain': 3,
  tile: 1.2,
};

/**
 * Colour map + bump map for a façade system in a given colour.
 * Systems: brick, precast, board-concrete, concrete, render, timber, stone/travertine, metal, tile.
 */
export function materialTexture(system, hex) {
  return cached(`mat:${system}:${hex}`, () => {
    const S = 256;
    const seed = hashString(system + hex);
    const r = rng(seed);
    const fine = fbm(S, 8, 3, seed);
    const h = new Float32Array(S * S);
    let contrast;
    switch (system) {
      case 'brick':
      case 'tile': {
        // running bond: 5 courses per tile, 76mm course + 10mm joint
        const courses = system === 'tile' ? 4 : 14;
        const per = system === 'tile' ? 4 : 5.5;
        const ch = S / courses;
        const bw = S / per;
        const shade = Array.from({ length: courses * 8 }, () => 0.75 + r() * 0.5);
        for (let y = 0; y < S; y++) {
          const row = Math.floor(y / ch);
          const inJointY = y % ch < 2;
          const off = row % 2 ? bw / 2 : 0;
          for (let x = 0; x < S; x++) {
            const col = Math.floor((x + off) / bw);
            const inJointX = (x + off) % bw < 2;
            const joint = inJointY || inJointX;
            const i = y * S + x;
            h[i] = joint ? 0.1 : 0.45 * shade[(row * 8 + (col % 8)) % shade.length] + fine[i] * 0.2;
          }
        }
        contrast = 0.45;
        break;
      }
      case 'board-concrete': {
        const boards = 16;
        const bh = S / boards;
        const tone = Array.from({ length: boards }, () => 0.85 + r() * 0.3);
        for (let y = 0; y < S; y++) {
          const row = Math.floor(y / bh);
          const seam = y % bh < 1.5 ? 0.25 : 1;
          for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const grain = 0.5 + 0.5 * Math.sin((x / S) * Math.PI * 2 * (6 + (row % 3)) + fine[i] * 6);
            h[i] = seam * (0.4 * tone[row] + grain * 0.08 + fine[i] * 0.25);
          }
        }
        contrast = 0.28;
        break;
      }
      case 'timber': {
        const boards = 10;
        const bw = S / boards;
        const tone = Array.from({ length: boards }, () => 0.8 + r() * 0.4);
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const col = Math.floor(x / bw);
            const i = y * S + x;
            const gap = x % bw < 2 ? 0.2 : 1;
            const grain = 0.5 + 0.5 * Math.sin((y / S) * Math.PI * 2 * 3 + fine[i] * 9 + col);
            h[i] = gap * (0.35 * tone[col] + grain * 0.18);
          }
        }
        contrast = 0.4;
        break;
      }
      case 'metal': {
        // standing-seam cladding
        const seams = 6;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const u = (x % (S / seams)) / (S / seams);
            h[i] = (u < 0.06 ? 0.85 : 0.45) + fine[i] * 0.08;
          }
        }
        contrast = 0.25;
        break;
      }
      case 'stone':
      case 'travertine': {
        const vein = fbm(S, 4, 4, seed + 7);
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const joint = y % (S / 2) < 1.5 || x % (S / 2) < 1.5 ? 0.2 : 1;
            const band = 0.5 + 0.5 * Math.sin(y * 0.18 + vein[i] * 8);
            h[i] = joint * (0.42 + band * 0.1 + fine[i] * 0.12);
          }
        }
        contrast = 0.22;
        break;
      }
      case 'precast':
      case 'concrete': {
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const joint = y % S < 1.5 || x % S < 1.5 ? 0.3 : 1;
            h[i] = joint * (0.45 + fine[i] * 0.18);
          }
        }
        contrast = 0.18;
        break;
      }
      default: {
        // render / generic
        for (let i = 0; i < S * S; i++) h[i] = 0.45 + fine[i] * 0.14;
        contrast = 0.12;
      }
    }
    const { col, bmp } = paint(S, h, hex, contrast, fine, 0.03);
    const tile = SYSTEM_TILE[system] || 2;
    return { map: toTexture(col, { repeat: 1 / tile }), bumpMap: toTexture(bmp, { srgb: false, repeat: 1 / tile }), tile };
  });
}

/* ------------------------------------------------------------------ */
/* City façade data textures                                           */
/* ------------------------------------------------------------------ */

/**
 * Window-grid data textures for the instanced city façades (read by facade.js):
 *   R = wall/glass detail (0–1, mid 0.5), G = window mask, B = lit window.
 * One tile = `bays` × `floors` cells; the shader maps it at real bay/floor size.
 */
export const FACADE_KINDS = {
  glass: { bays: 4, floors: 4 },
  office: { bays: 4, floors: 4 },
  podium: { bays: 4, floors: 2 },
  apartment: { bays: 4, floors: 4 },
  brick: { bays: 4, floors: 4 },
  terrace: { bays: 2, floors: 2 },
  house: { bays: 4, floors: 2 },
};

export function facadeTexture(kind) {
  return cached(`facade:${kind}`, () => {
    const { bays, floors } = FACADE_KINDS[kind];
    const W = 64 * bays;
    const H = 64 * floors;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const r = rng(hashString(kind));
    const img = g.createImageData(W, H);
    const cw = W / bays;
    const chh = H / floors;
    const DS = Math.max(W, H);
    const detail = fbm(DS, 8, 3, hashString(kind) + 3);
    const cells = [];
    for (let f = 0; f < floors; f++) {
      for (let b = 0; b < bays; b++) {
        cells.push({ lit: r() < 0.16, tint: r(), open: r(), balcony: r() < 0.3 });
      }
    }
    for (let y = 0; y < H; y++) {
      // canvas y=0 is the top; flipY puts it at v=1, so floor 0 is the bottom row
      const fy = floors - 1 - Math.floor(y / chh);
      const ly = 1 - (y % chh) / chh; // 0 at floor line, 1 at the ceiling
      for (let x = 0; x < W; x++) {
        const bx = Math.floor(x / cw);
        const lx = (x % cw) / cw;
        const cell = cells[fy * bays + bx];
        let win = 0;
        switch (kind) {
          case 'glass':
            win = lx > 0.04 && lx < 0.96 && ly > 0.14 && ly < 0.97 ? 1 : 0;
            break;
          case 'office':
            win = lx > 0.03 && lx < 0.97 && ly > 0.32 && ly < 0.88 ? 1 : 0;
            break;
          case 'podium':
            win =
              fy === 0 ? (lx > 0.05 && lx < 0.95 && ly > 0.04 && ly < 0.86 ? 1 : 0) : lx > 0.1 && lx < 0.9 && ly > 0.35 && ly < 0.8 ? 1 : 0;
            break;
          case 'apartment': {
            const wide = cell.balcony ? 0.08 : 0.2;
            win = lx > wide && lx < 1 - wide && ly > (cell.balcony ? 0.05 : 0.28) && ly < 0.86 ? 1 : 0;
            break;
          }
          case 'brick':
            win = lx > 0.3 && lx < 0.7 && ly > 0.3 && ly < 0.84 ? 1 : 0;
            break;
          case 'terrace':
            win =
              fy === 0 && bx === 0 ? (lx > 0.3 && lx < 0.7 && ly < 0.8 ? 1 : 0) : lx > 0.32 && lx < 0.68 && ly > 0.3 && ly < 0.85 ? 1 : 0;
            break;
          case 'house':
            win = cell.open < 0.55 && lx > 0.25 && lx < 0.75 && ly > 0.32 && ly < 0.78 ? 1 : 0;
            break;
          default:
        }
        // subtle mullion in wide openings
        if (win && (kind === 'glass' || kind === 'office' || kind === 'apartment') && Math.abs(lx - 0.5) < 0.012) win = 0;
        const i = (y * W + x) * 4;
        const d = detail[y * DS + x];
        let R;
        if (win)
          R = 0.35 + cell.tint * 0.4 + (ly - 0.5) * 0.15; // glass tint + gradient
        else if (kind === 'brick' || kind === 'terrace') R = 0.4 + d * 0.3 + (y % 6 < 1 ? -0.15 : 0);
        else R = 0.42 + d * 0.22 + (ly < 0.04 ? -0.18 : 0); // slab line
        img.data[i] = Math.max(0, Math.min(255, R * 255));
        img.data[i + 1] = win * 255;
        img.data[i + 2] = win && cell.lit ? 255 : 0;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = toTexture(c, { srgb: false });
    t.userData = { bays, floors };
    return t;
  });
}

/* ------------------------------------------------------------------ */
/* Ground, roads, roofs, water                                         */
/* ------------------------------------------------------------------ */

/** Ground-plane textures (world-UV mapped by the caller). */
export function groundTexture(kind) {
  return cached(`ground:${kind}`, () => {
    const S = 256;
    const seed = hashString(kind);
    const n = fbm(S, 4, 5, seed);
    const f = fbm(S, 32, 2, seed + 9);
    const c = canvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const put = (i, [r, gg, b]) => {
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        const k = 0.85 + n[i] * 0.3 + (f[i] - 0.5) * 0.12;
        let rgb;
        switch (kind) {
          case 'lawn':
            rgb = [122 * k, 156 * k * (0.95 + n[i] * 0.1), 74 * k];
            if (Math.floor(y / 32) % 2) rgb = rgb.map((v) => v * 1.06); // mowing stripes
            break;
          case 'land':
            // gardens + nature strips seen from the air: mottled green/ochre
            rgb = [132 * k + n[i] * 30, 142 * k, 96 * k - n[i] * 10];
            break;
          case 'sand':
            rgb = [222 * k, 205 * k, 168 * k];
            break;
          case 'track':
            rgb = [150 * k, 112 * k, 78 * k];
            break;
          case 'footpath':
            rgb = [182 * k, 178 * k, 170 * k];
            if (x % 64 < 2 || y % 64 < 2) rgb = rgb.map((v) => v * 0.82);
            break;
          case 'roof':
            // corrugated / tiled roof relief, tinted by instance colour
            rgb = Array(3).fill(200 * (0.8 + 0.2 * Math.sin((x / S) * Math.PI * 2 * 24)) * (0.9 + f[i] * 0.2));
            break;
          case 'gravel':
            rgb = Array(3).fill(150 * k);
            break;
          default: // asphalt (sun-bleached, as it reads from the air)
            rgb = [108 * k, 109 * k, 112 * k];
        }
        put(
          i,
          rgb.map((v) => Math.max(0, Math.min(255, v))),
        );
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

/**
 * Road surface: u runs along the road, v across (0–1). `lanes` > 1 adds a dashed centre
 * line and edge lines (major roads); one tile = 12 m of road.
 */
export function roadTexture(major) {
  return cached(`road:${major}`, () => {
    const W = 256;
    const H = 128;
    const base = groundTexture('asphalt').image;
    const c = canvas(W, H);
    const g = c.getContext('2d');
    g.drawImage(base, 0, 0, W, H);
    // gutters
    g.fillStyle = 'rgba(60,60,64,0.35)';
    g.fillRect(0, 0, W, 5);
    g.fillRect(0, H - 5, W, 5);
    g.fillStyle = 'rgba(235,235,225,0.85)';
    if (major) {
      g.fillRect(0, 10, W, 2);
      g.fillRect(0, H - 12, W, 2);
      for (let x = 0; x < W; x += 64) g.fillRect(x, H / 2 - 1.5, 36, 3); // centre dashes
      g.fillStyle = 'rgba(235,235,225,0.5)';
      for (let x = 32; x < W; x += 64) {
        g.fillRect(x, H / 4, 22, 2);
        g.fillRect(x, (3 * H) / 4, 22, 2);
      }
    }
    return toTexture(c);
  });
}

/** Tileable water normal map from a sum of noise octaves (tangent space, +Z up). */
export function waterNormals() {
  return cached('water-normals', () => {
    const S = 256;
    const h = fbm(S, 8, 4, 4242);
    const c = canvas(S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
    const k = 3.2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * k;
        const dy = (at(x, y + 1) - at(x, y - 1)) * k;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * S + x) * 4;
        img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return toTexture(c, { srgb: false });
  });
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
