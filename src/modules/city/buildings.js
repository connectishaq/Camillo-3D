import * as THREE from 'three';
import { rng } from '../gfx/proctex.js';
import { createFacadeMaterial, createWorldUVMaterial } from '../gfx/facade.js';
import { Instances, GEO, setRangeVisible } from './instances.js';
import { lotOK } from './layout.js';
import { EXTENT, hoddleUV } from './land.js';

/*
 * The city's buildings, generated per block and drawn with InstancedMesh:
 *  - CBD & tower precincts: podium + shaft (+ upper setback), rooftop plant, some crowns
 *  - inner suburbs: terrace rows and 2–6 storey apartment blocks (brick, render, timber)
 *  - outer suburbs: detached houses with hip/gable roofs (terracotta, Colorbond)
 * LOD: far away, each street edge of an outer block is one long "house row"; when the
 * camera comes within ~2 km, that superblock swaps its rows for individual houses (built
 * on demand, then cached).
 */

export const PAL = {
  brick: ['#8a4a36', '#9b5a42', '#7a4434', '#a8764f', '#c9b48f', '#6e5a4e', '#b07a58'],
  render: ['#e7e1d6', '#d8d0c2', '#f0ece4', '#c9c2b5', '#b9b3a8', '#dcd3c3'],
  timber: ['#9a7654', '#7d5f45', '#b08a62'],
  houseWall: ['#e8e2d6', '#d9cfbf', '#c9a888', '#a86a4e', '#9b5a42', '#f1ede5', '#bdb3a2', '#8f8a80'],
  roof: ['#a4553a', '#b86b4b', '#8e4a35', '#5b6064', '#3f4448', '#8b8f8d', '#c8c6bc', '#6d5a4c'],
  office: ['#d4d0c7', '#c2bdb3', '#e1ddd5', '#b3b0aa', '#cfc8ba'],
  glassWall: ['#c5ccd2', '#aeb8c0', '#d8dde0', '#9aa6ae'],
  podium: ['#b9b3a8', '#a79f94', '#cfc8bb', '#8f8a82'],
};
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

/** Mesh recipe per bucket key: [geometry, material key, casts shadow]. */
const RECIPE = {
  glass: ['box', 'glass'], office: ['box', 'office'], podium: ['box', 'podium'], apartment: ['box', 'apartment'],
  brick: ['box', 'brick'], terrace: ['box', 'terrace'], house: ['box', 'house'], rowBody: ['box', 'house'],
  gable: ['gable', 'roof'], hip: ['hip', 'roof'], rowRoof: ['gable', 'roof'], plant: ['box', 'plant'],
  pyr: ['pyramid', 'crown'], cyl: ['cylinder', 'crown'], fence: ['box', 'fence', false], drive: ['box', 'drive', false],
};

export function createCityMaterials() {
  const std = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    glass: createFacadeMaterial('glass', { bay: 3, floor: 3.8, glass: '#7390a6', roof: '#7d7f82', litStrength: 0.5, glassRough: 0.06, glassMetal: 0.88, roughness: 0.6 }),
    office: createFacadeMaterial('office', { bay: 3.4, floor: 3.8, glass: '#405869', roof: '#838380', litStrength: 0.7 }),
    podium: createFacadeMaterial('podium', { bay: 5, floor: 4.5, glass: '#3a4a55', roof: '#7c7b77' }),
    apartment: createFacadeMaterial('apartment', { bay: 3.4, floor: 3.1, glass: '#44535e', roof: '#8a8984' }),
    brick: createFacadeMaterial('brick', { bay: 3, floor: 3.1, glass: '#34414a', roof: '#7e7c77' }),
    terrace: createFacadeMaterial('terrace', { bay: 3.2, floor: 3.4, glass: '#2f3a42', roof: '#6f6d68' }),
    house: createFacadeMaterial('house', { bay: 3, floor: 3, glass: '#2f3a42', roof: '#6f6d68', litStrength: 0.4 }),
    roof: createWorldUVMaterial('roof', { scale: 5, roughness: 0.7 }),
    plant: std('#a2a4a6', 0.55, 0.35),
    crown: std('#c9ced3', 0.28, 0.85),
    fence: std('#d8d2c6', 0.9),
    drive: std('#b3afa7', 0.95),
  };
}

export const newSet = () => Object.fromEntries(Object.keys(RECIPE).map((k) => [k, new Instances()]));

/** Turn a set of Instances into meshes under `group`. */
export function buildSet(set, mats, group, { shadows = true } = {}) {
  const meshes = {};
  Object.entries(set).forEach(([key, inst]) => {
    const [geo, mat, cast = true] = RECIPE[key];
    const mesh = inst.build(GEO[geo], mats[mat], { shadows: shadows && cast, name: key });
    if (mesh) {
      group.add(mesh);
      meshes[key] = mesh;
    }
  });
  return meshes;
}

/* ------------------------------------------------------------------ */
/* Archetypes                                                          */
/* ------------------------------------------------------------------ */

const frameOf = (b) => ({ bx: -b.az, bz: b.ax, rot: Math.atan2(-b.az, b.ax) });
const at = (b, f, u, v) => [b.cx + b.ax * u + f.bx * v, b.cz + b.az * u + f.bz * v];

function tower(T, r, x, z, fw, fd, rot, H, podium = true) {
  const ph = podium ? 8 + r() * 12 : 0;
  if (podium) T.podium.push(x, 0, z, fw, ph, fd, rot, pick(r, PAL.podium));
  const inset = podium ? 2.5 + r() * 3 : 0;
  const sw = fw - inset * 2;
  const sd = fd - inset * 2;
  const kind = r() < 0.55 ? 'glass' : 'office';
  const wall = pick(r, kind === 'glass' ? PAL.glassWall : PAL.office);
  const stepped = H > 80 && r() < 0.5;
  const h1 = stepped ? (H - ph) * (0.55 + r() * 0.25) : H - ph;
  T[kind].push(x, ph, z, sw, h1, sd, rot, wall);
  let top = ph + h1;
  let tw = sw;
  let td = sd;
  if (stepped) {
    tw = sw * (0.62 + r() * 0.18);
    td = sd * (0.62 + r() * 0.18);
    T[kind].push(x, top, z, tw, H - top, td, rot, wall);
    top = H;
  }
  T.plant.push(x, top, z, tw * 0.42, 2.5 + r() * 2.5, td * 0.42, rot);
  const c = r();
  if (H > 110 && c < 0.18) T.pyr.push(x, top, z, tw * 0.75, 10 + r() * 22, td * 0.75, rot);
  else if (H > 110 && c < 0.3) {
    T.cyl.push(x, top, z, Math.min(tw, td) * 0.5, 6 + r() * 6, Math.min(tw, td) * 0.5, rot);
    T.cyl.push(x, top, z, 1.2, 30 + r() * 40, 1.2, rot); // spire
  }
}

function cbdBlock(b, r, T) {
  const f = frameOf(b);
  const [u] = hoddleUV(b.cx, b.cz);
  const k = 1 - 0.35 * Math.min(1, Math.abs(u) / 804) + (u > 200 ? 0.15 : 0); // taller to the east (Collins St)
  const lots = 2 + Math.floor(r() * 3);
  const lw = b.lenA / lots;
  for (let i = 0; i < lots; i++) {
    const uc = -b.lenA / 2 + lw * (i + 0.5);
    const [x, z] = at(b, f, uc, 0);
    const fw = lw - 3;
    const fd = b.lenB - 3;
    if (r() < 0.18) {
      // heritage / mid-rise
      const kind = r() < 0.5 ? 'brick' : 'apartment';
      T[kind].push(x, 0, z, fw, 12 + r() * 16, fd, f.rot, pick(r, kind === 'brick' ? PAL.brick : PAL.render));
    } else tower(T, r, x, z, fw, fd, f.rot, 35 + Math.pow(r(), 1.6) * 230 * k);
  }
}

function towerBlock(b, r, T, skip) {
  const f = frameOf(b);
  const lots = Math.max(1, Math.round(b.lenA / 55));
  const lw = b.lenA / lots;
  for (let i = 0; i < lots; i++) {
    const uc = -b.lenA / 2 + lw * (i + 0.5);
    const [x, z] = at(b, f, uc, 0);
    if (skip(x, z) || !lotOK(b, x, z, 12) || r() < 0.3) continue;
    const fw = Math.min(lw - 6, 22 + r() * 25);
    const fd = Math.min(b.lenB - 8, 20 + r() * 25);
    if (fd < 12) continue;
    if (r() < 0.35) T.apartment.push(x, 0, z, fw, 18 + r() * 20, fd, f.rot, pick(r, PAL.render));
    else tower(T, r, x, z, fw, fd, f.rot, 30 + Math.pow(r(), 1.5) * 170);
  }
}

export function innerBlock(b, r, T, skip, fine = false) {
  const f = frameOf(b);
  const maxDepth = b.lenB / 2 - 1.5;
  if (maxDepth < 9) return;
  [-1, 1].forEach((s) => {
    let t = -b.lenA / 2 + 1.5;
    while (t < b.lenA / 2 - 6) {
      const terrace = r() < 0.5;
      const pw = terrace ? 6 * (2 + Math.floor(r() * (fine ? 3 : 4))) : 18 + r() * 22;
      if (t + pw > b.lenA / 2 - 1) break;
      const uc = t + pw / 2;
      t += pw + r() * 3;
      const dep = Math.min(maxDepth, terrace ? 15 + r() * 3 : 15 + r() * 9);
      const vb = s * (b.lenB / 2 - 1.5 - dep / 2);
      const [x, z] = at(b, f, uc, vb);
      if (skip(x, z) || !lotOK(b, x, z)) continue;
      if (terrace) {
        const h = r() < 0.7 ? 7.2 : 10.4;
        const col = pick(r, r() < 0.55 ? PAL.brick : PAL.render);
        T.terrace.push(x, 0, z, pw, h, dep, f.rot, col);
        if (r() < 0.6) T.gable.push(x, h, z, pw + 0.3, 2.2, dep + 0.5, f.rot, pick(r, PAL.roof));
      } else {
        const floors = 2 + Math.floor(Math.pow(r(), 1.5) * 5);
        const h = floors * 3.1 + 0.6;
        const brick = r() < 0.45;
        const col = brick ? pick(r, PAL.brick) : pick(r, r() < 0.25 ? PAL.timber : PAL.render);
        T[brick ? 'brick' : 'apartment'].push(x, 0, z, pw, h, dep, f.rot, col);
        if (r() < 0.5) T.plant.push(x, h, z, Math.min(6, pw * 0.25), 1.6, Math.min(4, dep * 0.25), f.rot);
      }
    }
  });
}

/** Detached houses; `fine` adds fences, driveways and some carports (close-up areas). */
export function outerBlock(b, r, T, skip, fine = false) {
  const f = frameOf(b);
  [-1, 1].forEach((s) => {
    let t = -b.lenA / 2 + 3;
    while (t < b.lenA / 2 - 10) {
      const lw = 14 + r() * 5;
      if (t + lw > b.lenA / 2 - 3) break;
      const uc = t + lw / 2;
      t += lw;
      const hw = lw - 3 - r() * 2;
      const hd = 11 + r() * 7;
      const setback = 6 + r() * 3;
      const vb = s * (b.lenB / 2 - setback - hd / 2);
      if (Math.abs(vb) < hd / 2 + 1) continue; // block too shallow for a house on this side
      const [x, z] = at(b, f, uc, vb);
      if (skip(x, z) || !lotOK(b, x, z)) continue;
      const h = r() < 0.25 ? 5.9 : 3.1;
      T.house.push(x, 0, z, hw, h, hd, f.rot, pick(r, PAL.houseWall));
      const rh = 0.9 + Math.min(hw, hd) * 0.22;
      const roofRot = hw >= hd ? f.rot : f.rot + Math.PI / 2;
      const [rw, rd] = hw >= hd ? [hw + 0.8, hd + 0.8] : [hd + 0.8, hw + 0.8];
      T[r() < 0.65 ? 'hip' : 'gable'].push(x, h, z, rw, rh, rd, roofRot, pick(r, PAL.roof));
      if (fine) {
        const dw = 3.2;
        const side = r() < 0.5 ? -1 : 1;
        const du = uc + side * (lw / 2 - dw / 2 - 0.4);
        const a = side > 0 ? uc - lw / 2 + 0.2 : du + dw / 2;
        const bEnd = side > 0 ? du - dw / 2 : uc + lw / 2 - 0.2;
        const [fx, fz] = at(b, f, (a + bEnd) / 2, s * (b.lenB / 2 - 0.4));
        if (r() < 0.8) T.fence.push(fx, 0, fz, bEnd - a, 0.9 + r() * 0.5, 0.1, f.rot, pick(r, ['#d8d2c6', '#6b5a48', '#2f3133', '#e6e1d8']));
        const [dx, dz] = at(b, f, du, s * (b.lenB / 2 - setback / 2 - 0.2));
        T.drive.push(dx, 0.02, dz, dw, 0.06, setback + 0.6, f.rot);
        if (r() < 0.3) {
          const [gx, gz] = at(b, f, du, s * (b.lenB / 2 - setback - 3));
          T.house.push(gx, 0, gz, dw + 0.4, 2.6, 6, f.rot, '#cfcac1');
          T.gable.push(gx, 2.6, gz, dw + 0.8, 0.6, 6.4, f.rot + Math.PI / 2, pick(r, PAL.roof));
        }
      }
    }
  });
}

/** Far LOD for an outer block: one long house row per street edge. */
function rowBlock(b, r, T, skip) {
  const f = frameOf(b);
  if (b.lenB < 34) return;
  [-1, 1].forEach((s) => {
    const len = b.lenA - 10;
    if (len < 20) return;
    const [x, z] = at(b, f, 0, s * (b.lenB / 2 - 7.5 - 7));
    if (skip(x, z) || !lotOK(b, x, z)) return;
    const h = 3.6 + r() * 1.2;
    T.rowBody.push(x, 0, z, len, h, 14, f.rot, pick(r, PAL.houseWall));
    T.rowRoof.push(x, h, z, len + 0.6, 3.2, 15, f.rot, pick(r, PAL.roof));
  });
}

/* ------------------------------------------------------------------ */
/* Manager                                                             */
/* ------------------------------------------------------------------ */

const REGION = 4800;

export class CityBuildings {
  /**
   * @param layout   from buildLayout()
   * @param options  detail: [x, z, r][] areas built by detail.js (skipped here);
   *                 clear:  [x, z, r][] project sites kept empty
   */
  constructor(layout, mats, { detail = [], clear = [], nearRadius = 2200 } = {}) {
    this.layout = layout;
    this.mats = mats;
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.nearRadius = nearRadius;
    this.near = new Map(); // superblock index → { group, built }
    this.queue = [];
    const inAny = (list, x, z) => list.some(([cx, cz, rr]) => (x - cx) ** 2 + (z - cz) ** 2 < rr * rr);
    this.skip = (x, z) => inAny(detail, x, z) || inAny(clear, x, z);

    // outer blocks per superblock, for lazy near-LOD houses
    this.outerBySb = new Map();
    const regions = new Map();
    const central = newSet();
    layout.blocks.forEach((b) => {
      const r = rng(b.seed);
      if (b.kind === 'cbd') return cbdBlock(b, r, central);
      if (b.zone === 'tower') return towerBlock(b, r, central, this.skip);
      const key = `${Math.floor((b.cx - EXTENT.x0) / REGION)}:${Math.floor((b.cz - EXTENT.z0) / REGION)}`;
      if (!regions.has(key)) regions.set(key, newSet());
      const set = regions.get(key);
      if (b.zone === 'inner') return innerBlock(b, r, set, this.skip);
      if (!this.outerBySb.has(b.sb)) this.outerBySb.set(b.sb, { blocks: [], region: key });
      this.outerBySb.get(b.sb).blocks.push(b);
    });
    // far rows, ranges marked per superblock so they can be hidden when houses load
    this.outerBySb.forEach(({ blocks, region }, sb) => {
      const set = regions.get(region);
      set.rowBody.begin(sb);
      set.rowRoof.begin(sb);
      blocks.forEach((b) => rowBlock(b, rng(b.seed + 1), set, this.skip));
      set.rowBody.end(sb);
      set.rowRoof.end(sb);
    });

    this.centralMeshes = buildSet(central, mats, this.group);
    this.regionMeshes = new Map();
    regions.forEach((set, key) => {
      const g = new THREE.Group();
      g.name = `region:${key}`;
      this.group.add(g);
      this.regionMeshes.set(key, buildSet(set, mats, g));
    });
    this.stats = { central: Object.values(central).reduce((n, s) => n + s.count, 0) };
  }

  /** Build the individual houses of one superblock (on demand). */
  buildNear(sb) {
    const entry = this.outerBySb.get(sb);
    const set = newSet();
    entry.blocks.forEach((b) => outerBlock(b, rng(b.seed + 2), set, this.skip));
    const group = new THREE.Group();
    group.name = `near:${sb}`;
    buildSet(set, this.mats, group);
    this.group.add(group);
    return group;
  }

  setNear(sb, on) {
    const entry = this.outerBySb.get(sb);
    let state = this.near.get(sb);
    if (on && !state) {
      state = { group: this.buildNear(sb) };
      this.near.set(sb, state);
    }
    if (!state) return;
    if (state.group.visible === on && state.applied) return;
    state.group.visible = on;
    state.applied = true;
    const rm = this.regionMeshes.get(entry.region);
    setRangeVisible(rm.rowBody, sb, !on);
    setRangeVisible(rm.rowRoof, sb, !on);
  }

  /** LOD: houses near the camera target, rows elsewhere. Builds at most one superblock per frame. */
  update(tx, tz, altitude) {
    const R = this.nearRadius;
    let built = false;
    this.outerBySb.forEach((_, sb) => {
      const s = this.layout.superblocks[sb];
      const d = Math.hypot(s.cx - tx, s.cz - tz);
      const state = this.near.get(sb);
      const isOn = state?.group.visible;
      const want = altitude < 3200 && (isOn ? d < R + 500 : d < R);
      if (want && !state) {
        if (built) return;
        built = true;
      }
      if (want !== !!isOn || (want && !state)) this.setNear(sb, want);
    });
  }
}
