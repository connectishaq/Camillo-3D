import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes every visible mesh under `root` into world space and merges them by material
 * key (`material.userData.key`, else the material uuid). Returns a Group with one Mesh
 * per key — a few draw calls instead of thousands. Invisible helpers (hit volumes,
 * hidden edges) are skipped.
 */
export function mergeByMaterial(root, { shadows = true, skip = () => false } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || skip(o)) return;
    if (o.material?.colorWrite === false) return;
    let visible = true;
    for (let p = o.parent; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;
    const mat = o.material;
    const key = mat.userData.key || mat.uuid;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(o.matrixWorld);
    if (!buckets.has(key)) buckets.set(key, { mat, geos: [] });
    buckets.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  buckets.forEach(({ mat, geos }, key) => {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    const m = mat.clone();
    m.opacity = mat.userData.baseOpacity ?? mat.opacity;
    m.userData = { ...mat.userData };
    const mesh = new THREE.Mesh(merged, m);
    mesh.name = `merged:${key}`;
    mesh.castShadow = shadows && !m.transparent;
    mesh.receiveShadow = shadows;
    out.add(mesh);
  });
  return out;
}
