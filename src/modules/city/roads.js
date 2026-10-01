import * as THREE from 'three';
import { roadTexture } from '../gfx/proctex.js';
import { createWorldUVMaterial } from '../gfx/facade.js';

/*
 * Road surfaces from the layout: asphalt strips (lane markings on major roads) laid over
 * slightly wider footpath strips. Everything is merged into three meshes; layering is by
 * polygon offset so it holds at every zoom level.
 */
function strips(list, widen, y, uvTile) {
  const pos = [];
  const uv = [];
  const idx = [];
  list.forEach((r) => {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    if (len < 1) return;
    const dx = (r.bx - r.ax) / len;
    const dz = (r.bz - r.az) / len;
    const hw = r.w / 2 + widen;
    const nx = -dz * hw;
    const nz = dx * hw;
    // extend a little so crossings overlap cleanly
    const ex = dx * (widen + 2);
    const ez = dz * (widen + 2);
    const k = pos.length / 3;
    pos.push(
      r.ax - ex + nx, y, r.az - ez + nz,
      r.ax - ex - nx, y, r.az - ez - nz,
      r.bx + ex + nx, y, r.bz + ez + nz,
      r.bx + ex - nx, y, r.bz + ez - nz,
    );
    const u = (len + 2 * (widen + 2)) / uvTile;
    uv.push(0, 1, 0, 0, u, 1, u, 0);
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure faces point up
  if (g.attributes.normal.count && g.attributes.normal.getY(0) < 0) {
    const flipped = [];
    for (let i = 0; i < idx.length; i += 3) flipped.push(idx[i], idx[i + 2], idx[i + 1]);
    g.setIndex(flipped);
    g.computeVertexNormals();
  }
  return g;
}

export function buildRoads(layout) {
  const group = new THREE.Group();
  group.name = 'roads';
  const { major, minor } = layout.roads;
  const off = (f) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f * 2 });

  const foot = createWorldUVMaterial('footpath', { scale: 6, roughness: 0.95, ...off(-2) });
  const minorMat = new THREE.MeshStandardMaterial({ map: roadTexture(false), roughness: 0.92, ...off(-3) });
  const majorMat = new THREE.MeshStandardMaterial({ map: roadTexture(true), roughness: 0.9, ...off(-4) });

  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.receiveShadow = true;
    group.add(m);
  };
  add(strips([...major, ...minor], layout.footpath, 0.04, 6), foot, 'footpaths');
  add(strips(minor, 0, 0.07, 12), minorMat, 'roads-minor');
  add(strips(major, 0, 0.1, 12), majorMat, 'roads-major');
  return group;
}
