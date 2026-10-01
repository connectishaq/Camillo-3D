import * as THREE from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer/three';

const D2R = Math.PI / 180;

/**
 * Local East-North-Up frame anchored at `origin` ([lng, lat]).
 * Same axes as CityStory's `toXZ`: x = east, y = up, z = south (north is -z), in metres.
 *
 * `matrix` maps ECEF (tile space) into this frame. Apply it to `tiles.group` and
 * everything else in the scene can live in plain local metres.
 */
export function createLocalFrame([lng, lat]) {
  const enu = WGS84_ELLIPSOID.getEastNorthUpFrame(lat * D2R, lng * D2R, 0, new THREE.Matrix4());
  // ENU is (x east, y north, z up); rotate -90° about X to get (x east, y up, z south)
  const matrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(enu.invert());

  /** [lng, lat] (+ ellipsoid height) → local position. Includes Earth curvature. */
  const toLocal = ([lo, la], height = 0, target = new THREE.Vector3()) =>
    WGS84_ELLIPSOID.getCartographicToPosition(la * D2R, lo * D2R, height, target).applyMatrix4(matrix);

  return { matrix, toLocal };
}

/**
 * Finds the real surface height under a point by raycasting straight down onto
 * whatever tiles are loaded. Samples a small ring and keeps the lowest hit so a
 * rooftop at the exact centre doesn't lift the "ground".
 */
export class GroundSampler {
  constructor(tilesGroup) {
    this.group = tilesGroup;
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;
    this.down = new THREE.Vector3(0, -1, 0);
    this.origin = new THREE.Vector3();
    this.hits = [];
  }

  /** Surface height at (x, z), or null if no tiles are loaded there yet. */
  heightAt(x, z) {
    this.origin.set(x, 9000, z);
    this.ray.set(this.origin, this.down);
    this.ray.far = 12000;
    this.hits.length = 0;
    this.ray.intersectObject(this.group, true, this.hits);
    return this.hits.length ? this.hits[0].point.y : null;
  }

  /** Lowest surface in a `radius` ring around (x, z): a robust "street level". */
  groundAt(x, z, radius = 45) {
    let best = null;
    const probe = (px, pz) => {
      const h = this.heightAt(px, pz);
      if (h !== null && (best === null || h < best)) best = h;
    };
    probe(x, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      probe(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
    }
    return best;
  }

  /** Highest surface in a ring: used to keep the camera clear of towers. */
  peakAt(x, z, radius = 30) {
    let best = null;
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = i === 6 ? 0 : radius;
      const h = this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (h !== null && (best === null || h > best)) best = h;
    }
    return best;
  }
}
