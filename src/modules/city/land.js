import {
  BAY, RIVERS, LAKES, PARKS, RACECOURSES, TOWER_ZONES, HODDLE, ARTERIALS,
  toXZ, pointInPolygon, distToPolyline, inEllipse,
} from './geo.js';

/*
 * Land-use raster for the generated city (40 m cells over ~28 × 28 km). Built once from
 * geo.js and used for every placement query (roads, lots, trees), so generation stays fast.
 */
export const EXTENT = { x0: -13600, x1: 15600, z0: -10000, z1: 19200 };
export const CELL = 40;
export const LAND = 0;
export const WATER = 1;
export const PARK = 2;
export const TRACK = 3;
export const COAST = 4; // land within ~60 m of the bay: beach, no buildings

const NX = Math.ceil((EXTENT.x1 - EXTENT.x0) / CELL);
const NZ = Math.ceil((EXTENT.z1 - EXTENT.z0) / CELL);

let mask;
export const bay = BAY.map(toXZ);
export const rivers = RIVERS.map((r) => ({ ...r, xz: r.path.map(toXZ) }));
export const lakes = LAKES.map(ellipseXZ);
export const parks = PARKS.map(ellipseXZ);
export const racecourses = RACECOURSES.map(ellipseXZ);
export const coastLine = bay.slice(0, 25); // the real shoreline part of the bay polygon
export const hoddle = (() => {
  const [cx, cz] = toXZ(HODDLE.center);
  const a = HODDLE.angle;
  return { cx, cz, ux: Math.cos(a), uz: -Math.sin(a), vx: Math.sin(a), vz: Math.cos(a), ...HODDLE };
})();
export const towerZones = TOWER_ZONES.map(([lng, lat, r]) => [...toXZ([lng, lat]), r]);
export const arterials = ARTERIALS.map((a) => {
  if (a.coast) {
    // offset the shoreline inland
    const pts = [];
    for (let i = a.coast[0]; i <= a.coast[1]; i++) {
      const [x, z] = bay[i];
      const [px, pz] = bay[Math.max(0, i - 1)];
      const [nx, nz] = bay[Math.min(bay.length - 1, i + 1)];
      let ox = -(nz - pz);
      let oz = nx - px;
      const len = Math.hypot(ox, oz) || 1;
      ox /= len;
      oz /= len;
      if (pointInPolygon([x + ox * 50, z + oz * 50], bay)) {
        ox = -ox;
        oz = -oz;
      }
      pts.push([x + ox * a.inland, z + oz * a.inland]);
    }
    return { ...a, xz: pts };
  }
  return { ...a, xz: a.path.map(toXZ) };
});

function ellipseXZ([lng, lat, rx, rz, rot]) {
  const [x, z] = toXZ([lng, lat]);
  return [x, z, rx, rz, rot];
}

const bboxOf = (pts, pad) => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  pts.forEach(([x, z]) => {
    b[0] = Math.min(b[0], x - pad);
    b[1] = Math.min(b[1], z - pad);
    b[2] = Math.max(b[2], x + pad);
    b[3] = Math.max(b[3], z + pad);
  });
  return b;
};
const inBox = (b, x, z) => x >= b[0] && z >= b[1] && x <= b[2] && z <= b[3];
const riverBoxes = rivers.map((r) => bboxOf(r.xz, r.width));
const coastBox = bboxOf(coastLine, 80);
const bayBox = bboxOf(bay, 0);

function classify(x, z) {
  if (inBox(bayBox, x, z) && pointInPolygon([x, z], bay)) return WATER;
  for (let k = 0; k < rivers.length; k++) if (inBox(riverBoxes[k], x, z) && distToPolyline([x, z], rivers[k].xz) < rivers[k].width / 2) return WATER;
  for (const e of lakes) if (inEllipse([x, z], e)) return WATER;
  for (const e of racecourses) if (inEllipse([x, z], e)) return TRACK;
  for (const e of parks) if (inEllipse([x, z], e)) return PARK;
  if (inBox(coastBox, x, z) && distToPolyline([x, z], coastLine) < 70) return COAST;
  return LAND;
}

export function buildMask() {
  if (mask) return mask;
  mask = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    const z = EXTENT.z0 + (j + 0.5) * CELL;
    for (let i = 0; i < NX; i++) mask[j * NX + i] = classify(EXTENT.x0 + (i + 0.5) * CELL, z);
  }
  return mask;
}

/** Land-use code at a point (WATER outside the extent). */
export function landAt(x, z) {
  const i = Math.floor((x - EXTENT.x0) / CELL);
  const j = Math.floor((z - EXTENT.z0) / CELL);
  if (i < 0 || j < 0 || i >= NX || j >= NZ) return WATER;
  return mask[j * NX + i];
}

export const isLand = (x, z) => landAt(x, z) === LAND;

/** Coordinates in the rotated Hoddle frame. */
export function hoddleUV(x, z) {
  const dx = x - hoddle.cx;
  const dz = z - hoddle.cz;
  return [dx * hoddle.ux + dz * hoddle.uz, dx * hoddle.vx + dz * hoddle.vz];
}
export function inHoddle(x, z, pad = 0) {
  const [u, v] = hoddleUV(x, z);
  return Math.abs(u) < hoddle.halfU + pad && Math.abs(v) < hoddle.halfV + pad;
}

/** 'cbd' | 'tower' | 'inner' | 'outer' */
export function zoneAt(x, z) {
  if (inHoddle(x, z)) return 'cbd';
  for (const [tx, tz, r] of towerZones) if (Math.hypot(x - tx, z - tz) < r) return 'tower';
  const stk = arterials[0];
  if (Math.hypot(x, z) < 3600 && distToPolyline([x, z], stk.xz) < 170) return 'tower';
  const r = Math.hypot(x - 900, z + 300);
  return r < 5200 ? 'inner' : 'outer';
}

/** Distance to the nearest named arterial minus its half width (negative = on the road). */
export function arterialClearance(x, z) {
  let best = Infinity;
  for (const a of arterials) best = Math.min(best, distToPolyline([x, z], a.xz) - a.width / 2);
  return best;
}
