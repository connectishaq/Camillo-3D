import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../../gfx/proctex.js';
import { Instances } from './instances.js';
import { EXTENT, landAt, PARK, LAND, arterials } from './land.js';

/*
 * Instanced low-poly trees: a eucalypt (tall trunk, clumpy grey-green canopy) and a
 * plane tree (short trunk, round fresh-green canopy). Parks are planted densely and
 * St Kilda Rd gets its boulevard rows; street trees are added per superblock when the
 * camera comes close (same LOD rule as the houses).
 */
const coloured = (geo, hex) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // slight per-vertex variation reads as foliage clumps
    const k = 0.85 + ((((Math.sin(i * 91.7) * 43758.5453) % 1) + 1) % 1) * 0.3;
    arr[i * 3] = c.r * k;
    arr[i * 3 + 1] = c.g * k;
    arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
};

function eucalypt() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.32, 7, 5, 1);
  trunk.translate(0, 3.5, 0);
  const parts = [coloured(trunk, '#9a8a78')];
  [
    [0, 8.2, 0, 2.6],
    [1.5, 7.2, 0.6, 1.9],
    [-1.2, 7.6, -0.9, 2.0],
    [0.4, 9.6, -0.4, 1.6],
  ].forEach(([x, y, z, r]) => {
    const c = new THREE.IcosahedronGeometry(r, 0);
    c.scale(1, 0.75, 1);
    c.translate(x, y, z);
    parts.push(coloured(c, '#6c7a4c'));
  });
  return mergeGeometries(parts);
}

function planeTree() {
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3.6, 5, 1);
  trunk.translate(0, 1.8, 0);
  const crown = new THREE.IcosahedronGeometry(3.4, 1);
  crown.scale(1, 0.85, 1);
  crown.translate(0, 6.2, 0);
  return mergeGeometries([coloured(trunk, '#6b5a47'), coloured(crown, '#5d8a3c')]);
}

export function createTreeAssets() {
  return {
    euc: eucalypt(),
    plane: planeTree(),
    material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
  };
}

const TINT_EUC = ['#ffffff', '#e6efd9', '#f3eedb', '#d9e3c8'];
const TINT_PLANE = ['#ffffff', '#e2f0d0', '#f4f7df', '#cfe3bd'];

function pushTree(sets, r, x, z, kindBias = 0.5, scale = 1) {
  const euc = r() < kindBias;
  const s = scale * (0.7 + r() * 0.6);
  (euc ? sets.euc : sets.plane).push(
    x,
    0,
    z,
    s,
    s * (0.85 + r() * 0.3),
    s,
    r() * Math.PI * 2,
    (euc ? TINT_EUC : TINT_PLANE)[Math.floor(r() * 4)],
  );
}

export class CityTrees {
  constructor(layout, assets, { skip = () => false, nearRadius = 2200, streetSpacing = 15 } = {}) {
    this.layout = layout;
    this.assets = assets;
    this.skip = skip;
    this.nearRadius = nearRadius;
    this.spacing = streetSpacing;
    this.group = new THREE.Group();
    this.group.name = 'trees';
    this.near = new Map();
    this.regions = [];

    // parks: jittered grid, grouped into 4.8 km regions for culling
    const R = 4800;
    const buckets = new Map();
    const bucket = (x, z) => {
      const key = `${Math.floor((x - EXTENT.x0) / R)}:${Math.floor((z - EXTENT.z0) / R)}`;
      if (!buckets.has(key)) buckets.set(key, { euc: new Instances(), plane: new Instances(), cx: 0, cz: 0, n: 0 });
      return buckets.get(key);
    };
    const r = rng(777);
    const S = 24;
    for (let z = EXTENT.z0; z < EXTENT.z1; z += S) {
      for (let x = EXTENT.x0; x < EXTENT.x1; x += S) {
        if (landAt(x, z) !== PARK) continue;
        if (r() > 0.62) continue;
        const px = x + (r() - 0.5) * S;
        const pz = z + (r() - 0.5) * S;
        if (landAt(px, pz) !== PARK || skip(px, pz)) continue;
        const b = bucket(px, pz);
        pushTree(b, r, px, pz, 0.55, 1.1);
        b.cx += px;
        b.cz += pz;
        b.n++;
      }
    }
    // St Kilda Rd boulevard rows (the elms and planes along the road)
    const stk = arterials.find((a) => a.boulevard);
    if (stk) {
      for (let i = 0; i < stk.xz.length - 1; i++) {
        const [ax, az] = stk.xz[i];
        const [bx, bz] = stk.xz[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        for (let t = 0; t < len; t += 12) {
          const x = ax + ((bx - ax) * t) / len;
          const z = az + ((bz - az) * t) / len;
          [-1, -0.36, 0.36, 1].forEach((o) => {
            const px = x + nx * o * (stk.width / 2 + (Math.abs(o) === 1 ? 3 : 0));
            const pz = z + nz * o * (stk.width / 2 + (Math.abs(o) === 1 ? 3 : 0));
            if (landAt(px, pz) === 1) return;
            const b = bucket(px, pz);
            pushTree(b, r, px, pz, 0.1, 1.15);
          });
        }
      }
    }
    buckets.forEach((b) => {
      const g = new THREE.Group();
      this.add(b.euc, assets.euc, g);
      this.add(b.plane, assets.plane, g);
      g.userData.center = b.n ? [b.cx / b.n, b.cz / b.n] : [0, 0];
      this.group.add(g);
      this.regions.push(g);
    });
  }

  add(inst, geo, group) {
    const m = inst.build(geo, this.assets.material, { shadows: true });
    if (m) group.add(m);
    return m;
  }

  /** Street trees along the local roads of one superblock. */
  buildStreetTrees(sbIndex) {
    const sb = this.layout.superblocks[sbIndex];
    const sets = { euc: new Instances(), plane: new Instances() };
    const r = rng(sbIndex * 101 + 7);
    const bias = sb.zone === 'outer' ? 0.55 : 0.2;
    sb.roads.forEach((rd) => {
      const len = Math.hypot(rd.bx - rd.ax, rd.bz - rd.az);
      const nx = -(rd.bz - rd.az) / len;
      const nz = (rd.bx - rd.ax) / len;
      for (let t = 8; t < len - 8; t += this.spacing) {
        [-1, 1].forEach((side) => {
          if (r() > 0.55) return;
          const off = rd.w / 2 + 1.4;
          const x = rd.ax + ((rd.bx - rd.ax) * t) / len + nx * off * side;
          const z = rd.az + ((rd.bz - rd.az) * t) / len + nz * off * side;
          if (landAt(x, z) !== LAND || this.skip(x, z)) return;
          pushTree(sets, r, x, z, bias, 0.85);
        });
      }
    });
    const g = new THREE.Group();
    this.add(sets.euc, this.assets.euc, g);
    this.add(sets.plane, this.assets.plane, g);
    this.group.add(g);
    return g;
  }

  /** Builds (hidden) the street trees of one not-yet-built superblock near a point; false when none is left. */
  prebuild(tx, tz) {
    const list = this.layout.superblocks;
    for (let i = 0; i < list.length; i++) {
      const sb = list[i];
      if (!sb.roads.length || this.near.has(i) || Math.hypot(sb.cx - tx, sb.cz - tz) >= this.nearRadius) continue;
      const g = this.buildStreetTrees(i);
      g.visible = false;
      this.near.set(i, g);
      return true;
    }
    return false;
  }

  /** Street trees near the camera target (none built while `build` is false, mid-flight). */
  update(tx, tz, altitude, camX, camZ, build = true) {
    const R = this.nearRadius;
    let built = false;
    this.layout.superblocks.forEach((sb, i) => {
      if (!sb.roads.length) return;
      const d = Math.hypot(sb.cx - tx, sb.cz - tz);
      const state = this.near.get(i);
      const want = altitude < 3200 && (state?.visible ? d < R + 500 : d < R);
      if (want && !state) {
        if (built || !build) return;
        built = true;
        this.near.set(i, this.buildStreetTrees(i));
      } else if (state) state.visible = want;
    });
    // park-tree regions fade out of the draw list when far from the camera
    this.regions.forEach((g) => {
      const [x, z] = g.userData.center;
      g.visible = Math.hypot(x - camX, z - camZ) < Math.max(12000, altitude * 3);
    });
  }
}
