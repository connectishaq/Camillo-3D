import * as THREE from 'three';
import { materialTexture } from '../../gfx/proctex.js';
import { palette, shade } from '../../gfx/palette.js';

/*
 * PBR materials for the parametric buildings, textured with procedural canvas maps
 * (gfx/proctex.js): colour + bump per façade system, at real-world scale (UVs are in
 * metres). No image downloads, so this works offline and in the single-file preview.
 *
 * Façade and interior colours describe each building's real materials (from the model specs
 * and typical finishes), so they live here rather than in the brand tokens. The scene around
 * the model (context blocks, ground) uses the --map-* tokens.
 */

const ROUGH = {
  brick: 0.9,
  tile: 0.7,
  precast: 0.8,
  concrete: 0.85,
  'board-concrete': 0.9,
  render: 0.9,
  timber: 0.75,
  travertine: 0.7,
  stone: 0.6,
  metal: 0.45,
};

const textured = (system, hex) => {
  const t = materialTexture(system, hex);
  return {
    color: '#ffffff',
    map: t.map,
    bumpMap: t.bumpMap,
    bumpScale: system === 'brick' || system === 'board-concrete' ? 1.6 : 0.8,
    roughness: ROUGH[system] ?? 0.85,
  };
};

/**
 * One set of materials per level (so each level can fade independently). `key` groups
 * identical materials when a building is merged for the city.
 */
export function createFloorMaterials(band, key = 'model') {
  const c = band.colors;
  const wallSystem = band.system === 'glass-curtain' ? 'metal' : band.system;
  const mk = (role, params, baseOpacity = 1) => {
    const m = new THREE.MeshStandardMaterial({ transparent: true, opacity: baseOpacity, ...params });
    m.userData = { baseOpacity, role, key: `${key}:${role}` };
    return m;
  };
  return {
    slab: mk('slab', textured('concrete', c.slab)),
    wall: mk('wall', textured(wallSystem, c.wall)),
    accent: mk('accent', textured(wallSystem === 'metal' ? 'metal' : 'render', c.accent)),
    balcony: mk('balcony', textured('concrete', band.balcony?.color || c.slab)),
    portal: mk('portal', textured('precast', band.frames?.color || c.slab)),
    frame: mk('frame', { color: c.frame, roughness: 0.35, metalness: 0.75 }),
    // reflective glazing: picks up the sky environment
    // glazing: reflective but not a mirror, so windows read as glass with a dark interior
    glass: mk('glass', { color: c.glass, roughness: 0.07, metalness: 0.55, envMapIntensity: 1.0, depthWrite: false }, 0.78),
    balustrade: mk('balustrade', { color: c.balustrade, roughness: 0.04, metalness: 0.55, envMapIntensity: 1.2, depthWrite: false }, 0.35),
    metal: mk('metal', { color: '#2b2e31', roughness: 0.45, metalness: 0.6, depthWrite: false }, 0.8),
    fin: mk('fin', { color: band.fins?.color || c.accent, roughness: 0.32, metalness: 0.8 }),
  };
}

const featureCache = new Map();
/** Shared, non-fading materials for signature features (canopies, columns, planting…). */
export function featureMaterial(hex, system = 'render', extra = {}) {
  const k = `${hex}:${system}:${JSON.stringify(extra)}`;
  if (featureCache.has(k)) return featureCache.get(k);
  let params;
  if (system === 'glass') params = { color: hex, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.3 };
  else if (system === 'water') params = { color: hex, roughness: 0.05, metalness: 0.2, emissive: '#0b4a60', emissiveIntensity: 0.5 };
  else if (system === 'metal') params = { color: hex, roughness: 0.4, metalness: 0.6 };
  else params = textured(system, hex);
  const m = new THREE.MeshStandardMaterial({ ...params, ...extra });
  m.userData = { key: `feature:${k}`, shared: true };
  featureCache.set(k, m);
  return m;
}

/** Shared interior materials (interiors are built on demand and disposed after). */
export function createInteriorMaterials() {
  const s = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  return {
    floor: s('#ffffff', { ...textured('timber', '#b8905f'), roughness: 0.65 }),
    tile: s('#ffffff', { ...textured('stone', '#ebe8e2'), roughness: 0.45 }),
    wall: s('#efeae2', { roughness: 0.95 }),
    core: s('#ffffff', textured('concrete', '#b9b5ad')),
    fabric: s('#3c3f45'),
    fabricLight: s('#cfc6b8'),
    linen: s('#f2eee8'),
    timber: s('#ffffff', { ...textured('timber', '#8a6645'), roughness: 0.6 }),
    stone: s('#ffffff', { ...textured('stone', '#e9e5de'), roughness: 0.35 }),
    black: s('#1d1e20', { roughness: 0.4, metalness: 0.3 }),
    plant: s('#4f6b45'),
    pot: s('#bfb3a2'),
    rug: s('#8f8577'),
    water: new THREE.MeshStandardMaterial({
      color: '#3aa6c9',
      roughness: 0.05,
      metalness: 0.2,
      emissive: '#0d4d63',
      emissiveIntensity: 0.6,
    }),
    glow: new THREE.MeshStandardMaterial({ color: '#7fd6f0', emissive: '#4fc4e8', emissiveIntensity: 1.4 }),
  };
}

/** Neighbouring context blocks and ground: the light city tones from the tokens. */
export function createContextMaterials() {
  const p = palette();
  return {
    block: new THREE.MeshStandardMaterial(textured('render', shade(p.building, -0.04))),
    ground: new THREE.MeshStandardMaterial({ ...textured('concrete', p.ground), roughness: 1 }),
  };
}
