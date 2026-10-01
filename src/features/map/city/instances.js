import * as THREE from 'three';

/*
 * Collects instance transforms + colours cheaply (flat arrays), then builds one
 * InstancedMesh. Ranges can be hidden/shown later (used for LOD swaps) without
 * rebuilding: hidden instances get a zero-scale matrix.
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Instances {
  constructor() {
    this.data = []; // x, y, z, sx, sy, sz, rot
    this.colors = [];
    this.marks = new Map();
  }

  get count() {
    return this.data.length / 7;
  }

  push(x, y, z, sx, sy, sz, rot = 0, color = null) {
    this.data.push(x, y, z, sx, sy, sz, rot);
    if (color) {
      _c.set(color);
      this.colors.push(_c.r, _c.g, _c.b);
    } else this.colors.push(1, 1, 1);
  }

  /** Remember [start, end) of the instances pushed under `key` (e.g. a superblock). */
  begin(key) {
    this.marks.set(key, [this.count, this.count]);
  }

  end(key) {
    const m = this.marks.get(key);
    if (m) m[1] = this.count;
  }

  build(geometry, material, { shadows = true, name = '' } = {}) {
    const n = this.count;
    if (!n) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    mesh.name = name;
    const d = this.data;
    const matrices = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      const k = i * 7;
      _q.setFromAxisAngle(UP, d[k + 6]);
      _m.compose(_p.set(d[k], d[k + 1], d[k + 2]), _q, _s.set(d[k + 3], d[k + 4], d[k + 5]));
      _m.toArray(matrices, i * 16);
    }
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.colors), 3);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.userData.original = matrices;
    mesh.userData.marks = this.marks;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    return mesh;
  }
}

/** Hide or restore the instances recorded under `key` in a mesh built by Instances. */
export function setRangeVisible(mesh, key, visible) {
  const range = mesh?.userData.marks?.get(key);
  if (!range || range[1] <= range[0]) return;
  const arr = mesh.instanceMatrix.array;
  const orig = mesh.userData.original;
  for (let i = range[0]; i < range[1]; i++) {
    if (visible) arr.set(orig.subarray(i * 16, i * 16 + 16), i * 16);
    else ZERO.toArray(arr, i * 16);
  }
  mesh.instanceMatrix.addUpdateRange(range[0] * 16, (range[1] - range[0]) * 16);
  mesh.instanceMatrix.needsUpdate = true;
}

/* ---- shared unit geometries (base at y = 0) ---- */

const withUV = (g) => {
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
};

export const GEO = {
  box: (() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  })(),
  /** Gable roof: footprint 1×1, ridge along x at y = 1. */
  gable: (() => {
    const g = new THREE.BufferGeometry();
    const v = [
      // two slopes
      -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5,
      -0.5, 1, 0, 0.5, 1, 0,
      // gable ends
      0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return withUV(g);
  })(),
  /** Hip roof (pyramid-ish) for detached houses. */
  hip: (() => {
    const g = new THREE.BufferGeometry();
    const r = 0.25; // ridge half length
    const P = { a: [-0.5, 0, 0.5], b: [0.5, 0, 0.5], c: [0.5, 0, -0.5], d: [-0.5, 0, -0.5], e: [-r, 1, 0], f: [r, 1, 0] };
    const tri = (...k) => k.flatMap((n) => P[n]);
    const v = [
      ...tri('a', 'b', 'f'),
      ...tri('a', 'f', 'e'),
      ...tri('c', 'd', 'e'),
      ...tri('c', 'e', 'f'),
      ...tri('b', 'c', 'f'),
      ...tri('d', 'a', 'e'),
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return withUV(g);
  })(),
  pyramid: (() => {
    const g = new THREE.ConeGeometry(0.7071, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.translate(0, 0.5, 0);
    return g;
  })(),
  cylinder: (() => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1);
    g.translate(0, 0.5, 0);
    return g;
  })(),
};
