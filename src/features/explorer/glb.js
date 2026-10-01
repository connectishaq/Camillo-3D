import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HIT_LAYER } from './building.js';
import { FLOOR_H } from '../../config.js';
import { palette } from '../../gfx/palette.js';

/*
 * Path A: a project model from an image-to-3D tool, saved as public/models/<slug>.glb.
 * The list of available GLBs is baked in at build time (vite.config.js → __GLB_MODELS__),
 * so the page never requests a model that isn't there.
 *
 * The model is auto-centred, oriented (street front → +Z) and scaled to the footprint and
 * height from the spec. For the explorer it is cloned once per level; each clone is
 * limited to its level's height band by two world-space clipping planes that follow the
 * level when it is exploded or lifted, so no manual splitting is needed.
 */
export const GLB_MODELS = new Set(typeof __GLB_MODELS__ !== 'undefined' ? __GLB_MODELS__ : []);

const cache = new Map();
let loader;

function getLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`));
  return loader;
}

export const hasGLB = (slug) => GLB_MODELS.has(slug);

const levelHeight = (model, f) => f.height || model.floorHeight || FLOOR_H;
const totalHeight = (model) => model.floors.reduce((h, f) => h + levelHeight(model, f), 0);

/** Loads and normalises `public/models/<slug>.glb` for `model`. Cached; resolves null on failure. */
export function loadGLB(slug, model) {
  if (!hasGLB(slug)) return Promise.resolve(null);
  if (!cache.has(slug)) {
    cache.set(
      slug,
      getLoader()
        .loadAsync(`${import.meta.env.BASE_URL}models/${slug}.glb`)
        .then((gltf) => normalise(gltf.scene, model))
        .catch((err) => {
          console.warn(`[models] ${slug}.glb could not be loaded, using the procedural model`, err);
          return null;
        }),
    );
  }
  return cache.get(slug);
}

/** Synchronous access once loaded (null if absent or still loading). */
export function loadedGLB(slug) {
  const p = cache.get(slug);
  return p?.resolved ?? null;
}

function normalise(scene, model) {
  const wrap = new THREE.Group();
  wrap.add(scene);
  const glb = model.glb || {};
  // orientation: explicit rotation from the spec, else match the long side to the spec's width axis
  let ry = THREE.MathUtils.degToRad(glb.rotate || 0);
  scene.rotation.y = ry;
  wrap.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(wrap);
  let size = box.getSize(new THREE.Vector3());
  if (
    glb.rotate === undefined &&
    size.x > size.z !== model.width > model.depth &&
    Math.abs(size.x - size.z) > 0.1 * Math.max(size.x, size.z)
  ) {
    ry += Math.PI / 2;
    scene.rotation.y = ry;
    wrap.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(wrap);
    size = box.getSize(new THREE.Vector3());
  }
  // scale each axis to the real footprint and height, then sit it on y = 0, centred
  const H = totalHeight(model);
  wrap.scale.set(model.width / size.x, H / size.y, model.depth / size.z);
  wrap.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  wrap.position.set(-c.x, -box.min.y, -c.z);
  wrap.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.geometry.userData.shared = true; // never disposed by per-floor clones
    }
  });
  const out = new THREE.Group();
  out.add(wrap);
  out.userData.glb = true;
  const entry = cache.get(model.slug);
  if (entry) entry.resolved = out;
  return out;
}

/**
 * Explorer structure from a normalised GLB: same shape as buildBuilding() returns.
 * Each level: a clone of the model (own materials, so it can fade), clipped to its band.
 */
export function buildGLBBuilding(model, source) {
  const root = new THREE.Group();
  const floors = [];
  let baseY = 0;
  model.floors.forEach((data, index) => {
    const fh = levelHeight(model, data);
    const sb = data.setback || 0;
    const w = model.width - sb * 2;
    const d = model.depth - sb * 2;
    const group = new THREE.Group();
    group.name = `floor-${index}`;
    group.position.y = baseY;

    const clone = source.clone(true);
    clone.position.y = -baseY; // keep the model in place; the group carries the level
    const lower = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const upper = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const mats = {};
    clone.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = list.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.userData = { ...c.userData, baseOpacity: m.opacity ?? 1, role: /glass|window/i.test(m.name) ? 'glass' : 'wall' };
        c.clippingPlanes = [lower, upper];
        c.clipShadows = true;
        c.side = THREE.DoubleSide; // cut faces show the inside instead of vanishing
        mats[c.uuid] = c;
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    group.add(clone);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.3, fh, d + 0.3)),
      new THREE.LineBasicMaterial({ color: palette().highlight, transparent: true, opacity: 0 }),
    );
    edges.position.y = fh / 2;
    group.add(edges);
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, fh, d + 0.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    hit.position.y = fh / 2;
    hit.userData.floorIndex = index;
    hit.layers.set(HIT_LAYER);
    group.add(hit);
    root.add(group);

    const v = new THREE.Vector3();
    const floor = { index, data, group, baseY, height: fh, w, d, mats, facade: clone, edges, hit, interior: null };
    // keep the band [level base, level top] in world space as the level moves
    floor.clip = () => {
      group.getWorldPosition(v);
      lower.constant = -(v.y - 0.001);
      upper.constant = v.y + fh + 0.001;
    };
    floor.clip();
    floors.push(floor);
    baseY += fh;
  });
  return { root, floors, features: new THREE.Group(), size: { w: model.width, d: model.depth, h: baseY }, glb: true };
}
