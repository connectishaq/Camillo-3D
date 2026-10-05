import * as THREE from 'three';
import gsap from 'gsap';
import { buildBuilding } from '../../explorer/building.js';
import { loadGLB, hasGLB } from '../../explorer/glb.js';
import { mergeByMaterial } from '../../../gfx/merge.js';
import { createSiteMarker, setMarkerActive } from './markers.js';
import { modelHeight } from '../../../data/models/index.js';
import { toXZ } from '../geo.js';

/*
 * Camillo's projects on the city map, using the same model as the Building Explorer:
 * the parametric model from src/data/models/<slug>.json, or public/models/<slug>.glb
 * when one exists. Merged per material for a handful of draw calls. The street front
 * (+Z) is turned towards the nearest road. The active project gets a burgundy ring,
 * a pulse and a soft light column.
 */
export const HQ_MODEL = {
  slug: 'camillo-hq',
  style: 'brick',
  width: 30,
  depth: 22,
  floors: [
    { label: 'Ground', program: 'lobby', units: 0 },
    { label: 'Level 1', program: 'whole-floor', units: 1 },
  ],
};

function facing(x, z, roads) {
  let best = Infinity;
  let dir = [0, 1];
  roads.forEach((r) => {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az) || 1;
    const dx = (r.bx - r.ax) / len;
    const dz = (r.bz - r.az) / len;
    const t = Math.max(0, Math.min(len, (x - r.ax) * dx + (z - r.az) * dz));
    const px = r.ax + dx * t;
    const pz = r.az + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best && d > 1) {
      best = d;
      dir = [(px - x) / d, (pz - z) / d];
    }
  });
  return Math.atan2(dir[0], dir[1]); // local +z → towards the road
}

const cityMaterials = (group) => {
  group.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.userData.role === 'glass') {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    }
  });
  return group;
};

export class ProjectModels {
  constructor(projects, office, roads) {
    this.group = new THREE.Group();
    this.group.name = 'projects';
    this.sites = new Map();
    const nearby = (x, z) =>
      roads.filter(
        (r) =>
          Math.min(Math.hypot(r.ax - x, r.az - z), Math.hypot(r.bx - x, r.bz - z)) < 900 ||
          Math.hypot((r.ax + r.bx) / 2 - x, (r.az + r.bz) / 2 - z) < 900,
      );

    const add = (key, coords, model) => {
      const [x, z] = toXZ(coords);
      const site = new THREE.Group();
      site.position.set(x, 0, z);
      site.rotation.y = facing(x, z, nearby(x, z));
      const content = cityMaterials(mergeByMaterial(buildBuilding(model).root));
      site.add(content);
      const radius = Math.max(model.width, model.depth) * 0.72 + 10;
      const marker = createSiteMarker({ radius, beamHeight: 70 });
      marker.group.rotation.y = -site.rotation.y;
      site.add(marker.group);
      this.group.add(site);
      const entry = { key, site, content, marker, height: modelHeight(model), radius, x, z };
      setMarkerActive(marker, false, gsap, { ring: 0.12, beam: 0 });
      this.sites.set(key, entry);
      if (hasGLB(model.slug)) {
        loadGLB(model.slug, model).then((glb) => {
          if (!glb) return;
          const clone = glb.clone(true);
          site.remove(entry.content);
          site.add(clone);
          entry.content = clone;
        });
      }
    };
    add('office', office.coords, HQ_MODEL);
    projects.forEach((p) => add(p.slug, p.coords, p.model));
  }

  /** Clearance circles [x, z, r] so the city leaves each site empty. */
  get clearings() {
    return [...this.sites.values()].map((s) => [s.x, s.z, s.radius + 6]);
  }

  highlight(slug) {
    this.sites.forEach((s, key) => {
      const on = key === slug;
      if (s.marker.active !== on) setMarkerActive(s.marker, on, gsap, { ring: 0.12, beam: 0 }, { ring: 0.5, beam: 0.3 });
    });
  }

  animate(time) {
    this.sites.forEach(({ marker }) => {
      if (marker.active) {
        const k = (time * 0.0005) % 1;
        marker.pulse.scale.setScalar(1 + k * 0.9);
        marker.mats.pulse.opacity = (1 - k) * 0.7;
      } else marker.mats.pulse.opacity = 0;
    });
  }
}

/** Site centres and clearances, available before the models are built (for the layout). */
export function siteClearings(projects, office) {
  const list = [[toXZ(office.coords), Math.max(HQ_MODEL.width, HQ_MODEL.depth)]];
  projects.forEach((p) => list.push([toXZ(p.coords), Math.max(p.model.width, p.model.depth)]));
  return list.map(([[x, z], s]) => [x, z, s * 0.72 + 16]);
}
