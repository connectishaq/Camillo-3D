import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createFloorMaterials, createContextMaterials, featureMaterial } from './materials.js';
import { metricBoxUV } from './textures.js';
import { FLOOR_H } from '../../config.js';
import { palette } from '../../gfx/palette.js';

/** Layer for invisible raycast volumes, so they never reach the render or AO passes. */
export const HIT_LAYER = 1;
const SLAB_T = 0.3;
const WALL_T = 0.25;
const SIDES = ['front', 'back', 'right', 'left'];
const NEXT = { front: ['left', 'right'], back: ['right', 'left'], right: ['front', 'back'], left: ['back', 'front'] };

/*
 * Parametric building generator. Reads a normalised spec (src/data/models/*.json via
 * normalizeSpec): per-level bands with a façade system, colours, window rhythm,
 * balconies, precast frames and fins, plus roof and signature features.
 *
 * Every level is its own group (for hover / explode / open-floor), and within a level
 * all parts are merged per material, so a whole building is a few hundred draw calls
 * at most in the explorer and far fewer once merged for the city.
 *
 * Side frame: "front" is +z (the street), u runs left→right along a façade, n is the
 * outward normal (0 = façade line, negative = recessed).
 */
function sideFrame(side, w, d) {
  switch (side) {
    case 'front':
      return { len: w, ry: 0, pos: (u, n) => [u, d / 2 + n] };
    case 'back':
      return { len: w, ry: Math.PI, pos: (u, n) => [-u, -d / 2 - n] };
    case 'right':
      return { len: d, ry: Math.PI / 2, pos: (u, n) => [w / 2 + n, -u] };
    default:
      return { len: d, ry: -Math.PI / 2, pos: (u, n) => [-w / 2 - n, u] };
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

/** Collects primitives per material and merges them into one mesh per material. */
class Batch {
  constructor() {
    this.parts = new Map();
  }

  add(mat, geo, x, y, z, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
    geo.applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
  }

  box(mat, sx, sy, sz, x, y, z, ry = 0, rx = 0, rz = 0) {
    if (sx <= 0.001 || sy <= 0.001 || sz <= 0.001) return;
    this.add(mat, metricBoxUV(new THREE.BoxGeometry(sx, sy, sz), sx, sy, sz), x, y, z, ry, rx, rz);
  }

  /** Box in a façade's side frame: size along (u, y, n), centred at (u, y, n). */
  side(S, mat, su, sy, sn, u, y, n) {
    const [x, z] = S.pos(u, n);
    this.box(mat, su, sy, sn, x, y, z, S.ry);
  }

  flush(parent, { shadows = true } = {}) {
    this.parts.forEach((geos, mat) => {
      const g = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = shadows && !mat.userData.noShadow;
      mesh.receiveShadow = shadows;
      parent.add(mesh);
    });
    this.parts.clear();
  }
}

const bayMatch = (rule, i, n) => {
  if (!rule || rule === 'all') return true;
  if (rule === 'alternate') return i % 2 === 0;
  if (rule === 'corners') return i === 0 || i === n - 1;
  if (Array.isArray(rule)) return rule.includes(i);
  return false;
};

/** Legacy site.js models (`style`, flat floors) → a minimal spec so old data still works. */
function ensureSpec(model) {
  if (model.bands) return model;
  const sys = { brick: 'brick', stone: 'travertine', glass: 'render', house: 'board-concrete' }[model.style] || 'render';
  const band = {
    system: sys,
    colors: { wall: '#d9d4ca', slab: '#cfcac1', frame: '#2a2b2d', glass: '#5d707c', accent: '#8e8b85', balustrade: '#a9c1cc' },
    windows: { bay: 3.2, wwr: 0.55, mullions: 1, frameDepth: 0.18, sill: 0.8, head: 0.4 },
    balcony: { type: 'full-width', depth: 1.6, balustrade: 'glass', sides: ['front'], bays: 'all' },
  };
  return {
    ...model,
    floorHeight: FLOOR_H,
    bands: { main: band },
    floors: model.floors.map((f) => ({ ...f, band: 'main' })),
    roof: { type: 'flat-parapet', parapet: 0.9, plant: true },
    features: model.pool ? [{ type: 'pool' }] : [],
  };
}

export function buildBuilding(input) {
  const model = ensureSpec(input);
  const root = new THREE.Group();
  const floors = [];
  const fh0 = model.floorHeight || FLOOR_H;
  const bandStart = {};
  const bandEnd = {};
  model.floors.forEach((f, i) => {
    bandStart[f.band] ??= i;
    bandEnd[f.band] = i;
  });

  let baseY = 0;
  model.floors.forEach((data, index) => {
    const fh = data.height || fh0;
    const band = model.bands[data.band];
    const sb = data.setback || 0;
    const w = model.width - sb * 2;
    const d = model.depth - sb * 2;
    const mats = createFloorMaterials(band, `${model.slug || 'model'}:${data.band}`);
    const group = new THREE.Group();
    group.name = `floor-${index}`;
    group.position.y = baseY;
    const facade = new THREE.Group();
    const structure = new Batch();
    const skin = new Batch();

    // floor slab
    structure.box(mats.slab, w, SLAB_T, d, 0, SLAB_T / 2, 0);

    const ctx = { model, band, data, index, fh, w, d, mats, bandStart: bandStart[data.band], bandEnd: bandEnd[data.band] };
    SIDES.forEach((side) => buildSide(skin, structure, side, ctx));

    // terrace where the next level steps in, roof on the top level
    const next = model.floors[index + 1];
    if (!next) buildRoof(structure, skin, ctx);
    else if ((next.setback || 0) > sb + 0.05) {
      structure.box(mats.slab, w, SLAB_T, d, 0, fh - SLAB_T / 2 + 0.001, 0);
      perimeter(skin, w, d, (S, len) => skin.side(S, mats.balustrade, len, 1.05, 0.03, 0, fh + 0.52, -0.1));
    }

    structure.flush(group);
    skin.flush(facade);
    group.add(facade);

    // hover outline
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.3, fh, d + 0.3)),
      new THREE.LineBasicMaterial({ color: palette().highlight, transparent: true, opacity: 0 }),
    );
    edges.position.y = fh / 2;
    group.add(edges);

    // invisible hit volume for raycasting
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, fh, d + 0.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    hit.position.y = fh / 2;
    hit.userData.floorIndex = index;
    hit.layers.set(HIT_LAYER);
    group.add(hit);

    root.add(group);
    floors.push({ index, data, group, baseY, height: fh, w, d, mats, facade, edges, hit, interior: null });
    baseY += fh;
  });

  const features = buildFeatures(model, floors);
  root.add(features);

  const height = baseY + SLAB_T;
  return { root, floors, features, size: { w: model.width, d: model.depth, h: height } };
}

/* ------------------------------------------------------------------ */
/* Façades                                                             */
/* ------------------------------------------------------------------ */

function balconyOn(band, side) {
  const b = band.balcony;
  if (!b) return null;
  if (b.sides.includes(side)) return b;
  return null;
}

function buildSide(skin, structure, side, ctx) {
  const { band, fh, w, d, mats } = ctx;
  const S = sideFrame(side, w, d);
  const L = S.len;
  const win = { ...band.windows, ...(band.sides?.[side] || {}) };
  const n = Math.max(1, Math.round(L / win.bay));
  const bw = L / n;
  const clearH = fh - SLAB_T;
  const y0 = SLAB_T;
  const nOff = -(band.recess || 0);
  const bal = balconyOn(band, side);
  const curtain = band.system === 'glass-curtain';
  const sill = curtain || (bal && bal.type !== 'projecting') ? Math.min(win.sill, 0.05) : win.sill;
  const head = win.head;
  const winH = Math.max(0.6, clearH - sill - head);
  const winW = curtain ? bw - 0.1 : Math.min(bw - 0.3, win.width ?? Math.max(0.5, (win.wwr * bw * clearH) / winH));
  const fw = win.frameWidth ?? 0.06;
  const fd = Math.max(0.06, win.frameDepth);
  const proud = !!win.proud;

  for (let i = 0; i < n; i++) {
    const uc = -L / 2 + bw * (i + 0.5);
    const balBay = bal && bayMatch(bal.bays, i, n);

    if (bal && bal.type === 'inset' && balBay) {
      // balcony carved into the façade: piers, head band, recessed glass wall, returns, balustrade
      const pw = 0.35;
      const ow = bw - pw * 2;
      const depth = bal.depth;
      const soffit = mats.accent;
      skin.side(S, mats.wall, pw, clearH, WALL_T, uc - bw / 2 + pw / 2, y0 + clearH / 2, nOff - WALL_T / 2);
      skin.side(S, mats.wall, pw, clearH, WALL_T, uc + bw / 2 - pw / 2, y0 + clearH / 2, nOff - WALL_T / 2);
      skin.side(S, soffit, ow, head, WALL_T, uc, y0 + clearH - head / 2, nOff - WALL_T / 2);
      skin.side(S, soffit, ow, 0.08, depth, uc, y0 + clearH - head - 0.04, nOff - depth / 2); // soffit
      skin.side(S, mats.glass, ow, clearH - head, 0.03, uc, y0 + (clearH - head) / 2, nOff - depth);
      skin.side(S, mats.frame, ow, fw, 0.08, uc, y0 + clearH - head - fw / 2, nOff - depth + 0.04);
      for (let k = 1; k <= Math.max(1, win.mullions); k++) {
        skin.side(
          S,
          mats.frame,
          fw,
          clearH - head,
          0.08,
          uc - ow / 2 + (ow * k) / (Math.max(1, win.mullions) + 1),
          y0 + (clearH - head) / 2,
          nOff - depth + 0.04,
        );
      }
      skin.side(S, soffit, 0.15, clearH - head, depth, uc - ow / 2 + 0.075, y0 + (clearH - head) / 2, nOff - depth / 2);
      skin.side(S, soffit, 0.15, clearH - head, depth, uc + ow / 2 - 0.075, y0 + (clearH - head) / 2, nOff - depth / 2);
      skin.side(S, mats.balustrade, ow, 1.05, 0.03, uc, y0 + 0.52, nOff - 0.08);
      continue;
    }

    // punched / ribbon / curtain opening
    const pw = (bw - winW) / 2;
    if (pw > 0.01) {
      skin.side(S, mats.wall, pw, clearH, WALL_T, uc - bw / 2 + pw / 2, y0 + clearH / 2, nOff - WALL_T / 2);
      skin.side(S, mats.wall, pw, clearH, WALL_T, uc + bw / 2 - pw / 2, y0 + clearH / 2, nOff - WALL_T / 2);
    }
    if (sill > 0.02) {
      if (win.panelBelow) {
        // ribbed panel (e.g. The Righi): recessed plate with horizontal ribs
        skin.side(S, mats.wall, winW, sill, WALL_T, uc, y0 + sill / 2, nOff - WALL_T / 2 - 0.08);
        const ribs = Math.round(sill / 0.12);
        for (let r = 0; r < ribs; r++) skin.side(S, mats.accent, winW, 0.05, 0.06, uc, y0 + 0.06 + r * (sill / ribs), nOff - 0.05);
      } else skin.side(S, mats.wall, winW, sill, WALL_T, uc, y0 + sill / 2, nOff - WALL_T / 2);
    }
    if (head > 0.02) skin.side(S, mats.wall, winW, head, WALL_T, uc, y0 + clearH - head / 2, nOff - WALL_T / 2);

    const gy = y0 + sill + winH / 2;
    const gn = proud ? nOff - 0.02 : nOff - fd; // glass line
    skin.side(S, mats.glass, winW, winH, 0.03, uc, gy, gn);
    // frame: proud frames stand out from the wall; otherwise they line the reveal
    const fn = proud ? nOff + fd / 2 : nOff - fd / 2;
    const fdd = proud ? fd : fd;
    skin.side(S, mats.frame, winW + fw * 2, fw, fdd, uc, gy + winH / 2 + fw / 2, fn);
    skin.side(S, mats.frame, winW + fw * 2, fw, fdd + 0.04, uc, gy - winH / 2 - fw / 2, fn + 0.02);
    skin.side(S, mats.frame, fw, winH, fdd, uc - winW / 2 - fw / 2, gy, fn);
    skin.side(S, mats.frame, fw, winH, fdd, uc + winW / 2 + fw / 2, gy, fn);
    const mull = curtain ? Math.max(0, win.mullions) : win.mullions;
    for (let k = 1; k <= mull; k++) {
      skin.side(S, mats.frame, fw * 0.8, winH, 0.07, uc - winW / 2 + (winW * k) / (mull + 1), gy, gn + 0.04);
    }
    if (curtain) skin.side(S, mats.frame, winW, fw, 0.07, uc, y0 + sill + winH * 0.62, gn + 0.04); // transom
  }

  // slab edge band on the façade
  skin.side(S, mats.slab, L + 0.02, SLAB_T, 0.06, 0, SLAB_T / 2, nOff + 0.02);

  if (bal) buildBalcony(skin, structure, S, side, bal, ctx, { n, bw });
  if (band.frames) buildFrames(skin, S, band.frames, ctx, { n, bw });
  if (band.fins && band.fins.sides.includes(side)) buildFins(skin, S, band.fins, bal, ctx, { n, bw, clearH });
}

function buildBalcony(skin, structure, S, side, bal, ctx, { n, bw }) {
  if (bal.type === 'inset') return;
  const { mats, band, index } = ctx;
  const L = S.len;
  const depth = bal.depth;
  const t = bal.slabThickness || SLAB_T;
  const bm = band.balcony?.color ? mats.balcony : mats.slab;
  const rail = (len, u, n0, alongN = false) => {
    let m = mats.balustrade;
    let thick = 0.03;
    if (bal.balustrade === 'solid') {
      m = bm;
      thick = 0.16;
    } else if (bal.balustrade === 'metal') m = mats.metal;
    if (bal.brassEvery && index % bal.brassEvery === 0) {
      m = mats.accent;
      thick = 0.06;
    }
    if (alongN) skin.side(S, m, thick, 1.05, len, u, t + 0.52, n0);
    else skin.side(S, m, len, 1.05, thick, u, t + 0.52, n0);
    if (bal.balustrade !== 'solid') skin.side(S, mats.frame, alongN ? 0.05 : len, 0.05, alongN ? len : 0.05, u, t + 1.07, n0);
  };

  if (bal.type === 'projecting') {
    for (let i = 0; i < n; i++) {
      if (!bayMatch(bal.bays, i, n)) continue;
      const uc = -L / 2 + bw * (i + 0.5);
      const bwid = bw * 0.94;
      skin.side(S, bm, bwid, t, depth, uc, t / 2, depth / 2);
      rail(bwid, uc, depth - 0.04);
      rail(depth, uc - bwid / 2 + 0.03, depth / 2, true);
      rail(depth, uc + bwid / 2 - 0.03, depth / 2, true);
    }
    return;
  }

  // full-width / wraparound: extend over the corner where the neighbouring side also has one
  const [prev, next] = NEXT[side];
  const wrapL = bal.type === 'wraparound' && bal.sides.includes(prev) ? depth : 0;
  const wrapR = bal.type === 'wraparound' && bal.sides.includes(next) ? depth : 0;
  const len = L + wrapL + wrapR;
  const uc = (wrapR - wrapL) / 2;
  skin.side(S, bm, len, t, depth, uc, t / 2, depth / 2);
  rail(len, uc, depth - 0.04);
  if (!wrapL) rail(depth, -L / 2 + 0.03, depth / 2, true);
  if (!wrapR) rail(depth, L / 2 - 0.03, depth / 2, true);
}

function buildFrames(skin, S, fr, ctx, { n, bw }) {
  const { mats, fh, index, bandStart, bandEnd } = ctx;
  const L = S.len;
  const every = fr.every || 2;
  const span = fr.span || 1;
  const fwid = fr.width || 0.8;
  const fdep = fr.depth || 0.4;
  const m = mats.portal;
  for (let j = 0; j <= n; j += every) {
    const u = Math.max(-L / 2 + fwid / 2, Math.min(L / 2 - fwid / 2, -L / 2 + j * bw));
    skin.side(S, m, fwid, fh, fdep, u, fh / 2, fdep / 2);
    if (fr.bevel) skin.side(S, m, fwid * 0.6, fh, 0.14, u, fh / 2, fdep + 0.07);
  }
  const rel = index - bandStart;
  if (rel % span === 0) {
    skin.side(S, m, L + fwid, fwid * 0.8, fdep, 0, fwid * 0.4, fdep / 2);
    if (fr.bevel) skin.side(S, m, L + fwid, fwid * 0.45, 0.14, 0, fwid * 0.4, fdep + 0.07);
  }
  if (index === bandEnd) skin.side(S, m, L + fwid, fwid * 0.8, fdep, 0, fh - fwid * 0.4, fdep / 2);
}

function buildFins(skin, S, fins, bal, ctx, { n, bw, clearH }) {
  const { mats } = ctx;
  const L = S.len;
  const nBase = bal && bal.type !== 'inset' ? bal.depth - 0.25 : fins.depth / 2;
  for (let i = 0; i < n; i++) {
    if (!bayMatch(fins.bays, i, n)) continue;
    const u0 = -L / 2 + bw * i;
    const count = Math.max(2, Math.floor(bw / fins.spacing));
    for (let k = 0; k < count; k++) {
      skin.side(S, mats.fin, fins.width, clearH, fins.depth, u0 + (bw * (k + 0.5)) / count, SLAB_T + clearH / 2, nBase);
    }
  }
}

function perimeter(batch, w, d, fn) {
  SIDES.forEach((side) => {
    const S = sideFrame(side, w, d);
    fn(S, S.len, side);
  });
}

/* ------------------------------------------------------------------ */
/* Roof                                                                */
/* ------------------------------------------------------------------ */

function buildRoof(structure, skin, ctx) {
  const { model, fh, w, d, mats } = ctx;
  const roof = model.roof;
  const top = fh + SLAB_T;
  if (roof.type === 'blade') {
    const o = roof.overhang ?? 1;
    structure.box(mats.slab, w + o * 2, 0.35, d + o * 2, 0, fh + 0.175, 0);
  } else {
    structure.box(mats.slab, w, SLAB_T, d, 0, fh + SLAB_T / 2, 0);
    const p = roof.parapet ?? 0.9;
    const cop = roof.coping ? featureMaterial(roof.coping, 'render') : mats.wall;
    perimeter(skin, w, d, (S, len) => {
      skin.side(S, mats.wall, len, p, 0.25, 0, top + p / 2, -0.125);
      skin.side(S, cop, len + 0.1, 0.06, 0.32, 0, top + p + 0.03, -0.12);
    });
  }
  if (roof.plant) {
    const pm = featureMaterial('#8a8d90', 'metal');
    structure.box(pm, Math.min(6, w * 0.3), 1.6, Math.min(4, d * 0.3), -w * 0.18, top + 0.8, -d * 0.12);
    structure.box(pm, Math.min(3, w * 0.15), 1.1, Math.min(3, d * 0.2), w * 0.15, top + 0.55, -d * 0.2);
  }
  if (roof.garden) {
    const green = featureMaterial('#4d6a3a', 'render');
    const planter = featureMaterial('#9b968d', 'concrete');
    const inset = 1.2;
    [-1, 1].forEach((s) => {
      structure.box(planter, w - inset * 2, 0.5, 0.9, 0, top + 0.25, s * (d / 2 - inset));
      structure.box(green, w - inset * 2 - 0.2, 0.55, 0.75, 0, top + 0.72, s * (d / 2 - inset));
    });
    // slim columnar trees along the street edge (as on La Storia / The London roofs)
    const leaf = featureMaterial('#5f7f3c', 'render', { roughness: 1 });
    const trees = Math.max(2, Math.round(w / 6));
    for (let i = 0; i < trees; i++) {
      const x = -w / 2 + inset + ((w - inset * 2) * (i + 0.5)) / trees;
      const crown = new THREE.IcosahedronGeometry(0.75, 1);
      crown.scale(1, 2.3, 1); // columnar (cypress-like)
      structure.add(leaf, crown, x, top + 2.6, d / 2 - inset);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Signature features                                                  */
/* ------------------------------------------------------------------ */

function buildFeatures(model, floors) {
  const g = new THREE.Group();
  g.name = 'features';
  const b = new Batch();
  const W = model.width;
  const D = model.depth;
  const fh = model.floorHeight || FLOOR_H;
  const f0 = floors[0];
  const groundH = f0?.height || fh;
  const S = (side) => sideFrame(side, W, D);

  (model.features || []).forEach((f) => {
    switch (f.type) {
      case 'wing': {
        // separate low pavilion in front of the main block (The London's restaurant)
        const c = f.colors || {};
        const frame = featureMaterial(c.frame || '#1f2123', 'metal', { metalness: 0.7, roughness: 0.35 });
        const glass = featureMaterial(c.glass || '#2f5c5f', 'glass');
        const slab = featureMaterial('#d3d0c8', 'concrete');
        const ww = f.width;
        const wd = f.depth;
        const lh = f.levelHeight || 4;
        const cx = f.offset || 0;
        const cz = D / 2 + wd / 2 - 0.5;
        for (let l = 0; l < f.levels; l++) {
          const y = l * lh;
          b.box(slab, ww, 0.35, wd, cx, y + 0.175, cz);
          b.box(glass, ww - 0.3, lh - 0.35, wd - 0.3, cx, y + 0.35 + (lh - 0.35) / 2, cz);
          const bays = Math.round(ww / 2.4);
          for (let i = 0; i <= bays; i++) {
            const x = cx - ww / 2 + (ww * i) / bays;
            b.box(frame, 0.12, lh, 0.2, x, y + lh / 2, cz + wd / 2 - 0.1);
          }
          const sb = Math.round(wd / 2.4);
          for (let i = 0; i <= sb; i++) b.box(frame, 0.2, lh, 0.12, cx + ww / 2 - 0.1, y + lh / 2, cz - wd / 2 + (wd * i) / sb);
          b.box(frame, ww + 0.1, 0.45, wd + 0.1, cx, y + lh - 0.2, cz);
        }
        const top = f.levels * lh;
        b.box(slab, ww, 0.4, wd, cx, top + 0.2, cz);
        if (f.roofGarden) {
          const green = featureMaterial('#4f6a3b', 'render');
          b.box(green, ww - 3, 0.7, 1.4, cx, top + 0.75, cz + wd / 2 - 1.2);
          b.box(green, 1.4, 0.7, wd - 3, cx + ww / 2 - 1.2, top + 0.75, cz);
          b.box(featureMaterial('#9aa0a2', 'glass'), ww, 1.05, 0.04, cx, top + 0.92, cz + wd / 2 - 0.05);
        }
        // dark canopy + timber slat awnings along the street
        b.box(featureMaterial(c.canopy || '#2a2c2e', 'metal'), ww + 2, 0.5, 3.4, cx, lh - 0.35, cz + wd / 2 + 1.5);
        const timber = featureMaterial(c.timber || '#b27a4b', 'timber');
        const aw = f.awnings || { count: 6, depth: 2.6 };
        for (let i = 0; i < aw.count; i++) {
          const z = cz - wd / 2 + ((wd + 4) * (i + 0.5)) / aw.count;
          b.box(timber, aw.depth, 0.14, 2.6, cx + ww / 2 + aw.depth / 2 + 0.2, lh * 0.82, z, 0, 0, -0.12);
        }
        break;
      }
      case 'vColumns': {
        const m = featureMaterial(f.color || '#c9bda7', 'travertine');
        const s = S(f.side || 'front');
        const count = f.count || 2;
        for (let i = 0; i < count; i++) {
          const u = -s.len / 2 + (s.len * (i + 0.5)) / count;
          [-1, 1].forEach((k) => {
            const [x, z] = s.pos(u + k * 0.7, -1.2);
            b.box(m, 0.7, groundH * 1.08, 0.8, x, groundH / 2, z, s.ry, 0, k * 0.35);
          });
        }
        break;
      }
      case 'wall': {
        const s = S(f.side || 'front');
        const [x, z] = s.pos(f.offset || 0, 5);
        b.box(
          featureMaterial(f.color || '#cbbfa9', 'travertine'),
          f.length || 20,
          f.height || 1.8,
          0.45,
          x,
          (f.height || 1.8) / 2,
          z,
          s.ry,
        );
        break;
      }
      case 'canopy': {
        const s = S(f.side || 'front');
        const [x, z] = s.pos(f.offset || 0, (f.depth || 1.8) / 2);
        b.box(
          featureMaterial(f.color || '#8b5234', 'metal', { metalness: 0.6, roughness: 0.4 }),
          f.width || 5,
          0.3,
          f.depth || 1.8,
          x,
          f.height || 3,
          z,
          s.ry,
        );
        break;
      }
      case 'slot': {
        const s = S(f.side || 'right');
        const H = floors.reduce((h, fl) => h + fl.height, 0);
        const [x, z] = s.pos(f.offset || 0, 0.02);
        b.box(featureMaterial(f.color || '#2e3032', 'glass'), f.width || 1.5, H - 0.5, 0.08, x, H / 2, z, s.ry);
        for (let k = 0; k < Math.floor(H / 0.9); k++)
          b.box(featureMaterial('#4a4d50', 'metal'), f.width || 1.5, 0.05, 0.1, x, 0.45 + k * 0.9, z, s.ry);
        break;
      }
      case 'columns':
      case 'greenColumns': {
        const s = S(f.side || 'front');
        const bal = model.bands[floors[0].data.band]?.balcony;
        const nOut = (bal?.depth || 2) - (f.type === 'columns' ? 0.35 : 1.1);
        const count = Math.max(1, Math.floor(s.len / (f.spacing || 12)));
        const H = floors.slice(0, f.levels || floors.length).reduce((h, fl) => h + fl.height, 0);
        const m =
          f.type === 'columns'
            ? featureMaterial(f.color || '#eeeeea', 'render')
            : featureMaterial(f.color || '#4f6d3b', 'render', { roughness: 1 });
        for (let i = 0; i < count; i++) {
          const u = -s.len / 2 + (s.len * (i + 0.5)) / count + (f.type === 'columns' ? 0 : s.len / count / 2);
          if (u > s.len / 2) continue;
          const [x, z] = s.pos(u, nOut);
          const r = f.radius || 0.3;
          const geo = f.type === 'columns' ? new THREE.CylinderGeometry(r, r, H, 12) : new THREE.CylinderGeometry(r * 0.85, r, H, 7, 6);
          if (f.type === 'greenColumns') jitter(geo, 0.18);
          b.add(m, geo, x, H / 2, z);
        }
        break;
      }
      case 'pool': {
        const pw = W * 0.55;
        const pd = 5;
        const z = D / 2 + pd / 2 + 2.2;
        const deck = featureMaterial('#b9b2a7', 'concrete');
        b.box(deck, W, groundH + SLAB_T, pd + 3, 0, (groundH + SLAB_T) / 2, z);
        const water = featureMaterial('#3aa6c9', 'water');
        b.box(water, pw, 0.1, pd, W * 0.12, groundH + SLAB_T + 0.02, z);
        break;
      }
      default:
    }
  });
  b.flush(g);
  return g;
}

function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * amt;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
}

/** A handful of neighbouring blocks for scale. Deterministic per project. */
export function buildContext(size, seed = 1) {
  const g = new THREE.Group();
  const mat = createContextMaterials().block;
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const R = Math.max(size.w, size.d);
  const b = new Batch();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.3;
    const dist = R * (1.6 + rand() * 1.4);
    const bw = 8 + rand() * 16;
    const bd = 8 + rand() * 14;
    const bh = 3 + rand() * size.h * 0.55;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (z > 0 && Math.abs(x) < R) continue; // keep the street front open
    b.box(mat, bw, bh, bd, x, bh / 2, z);
  }
  b.flush(g);
  return g;
}
