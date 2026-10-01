import * as THREE from 'three';
import { rng } from '../../../gfx/proctex.js';
import { Instances, GEO } from './instances.js';
import { newSet, buildSet, outerBlock, innerBlock } from './buildings.js';
import { landAt, LAND } from './land.js';

/*
 * Higher-detail neighbourhoods (~500 m) around each Camillo site: finer houses with
 * fences, driveways and carports (or finer terraces/apartments in inner suburbs),
 * denser street trees, parked cars and streetlights. The buildings are always drawn
 * (so the coarse city has no holes); the small extras only when the camera is near.
 */
export const DETAIL_RADIUS = 520;
const CAR_COLORS = ['#e9e9e7', '#2b2d30', '#8d9196', '#b8bcc0', '#5a1f1f', '#23344f', '#dcdcd6', '#4b5a3c'];

export class Neighbourhoods {
  constructor(layout, mats, trees, sites, { clear = [], extrasRadius = 3200 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'neighbourhoods';
    this.areas = [];
    this.extrasRadius = extrasRadius;
    const inClear = (x, z) => clear.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);
    const carMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#1f272d', roughness: 0.1, metalness: 0.8 });
    const poleMat = new THREE.MeshStandardMaterial({ color: '#50555a', roughness: 0.5, metalness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: '#f2efe6', emissive: '#fff2cf', emissiveIntensity: 0.4 });

    sites.forEach(([sx, sz], si) => {
      const R = DETAIL_RADIUS;
      const inArea = (x, z) => (x - sx) ** 2 + (z - sz) ** 2 < R * R;
      const skip = (x, z) => !inArea(x, z) || inClear(x, z);
      const set = newSet();
      layout.blocks.forEach((b) => {
        if (b.kind === 'cbd' || Math.hypot(b.cx - sx, b.cz - sz) > R + 200) return;
        const r = rng(b.seed + 99);
        if (b.zone === 'inner' || b.zone === 'tower') innerBlock(b, r, set, skip, true);
        else outerBlock(b, r, set, skip, true);
      });
      const area = new THREE.Group();
      area.name = `neighbourhood:${si}`;
      buildSet(set, mats, area);

      // extras along the local roads inside the area
      const extras = new THREE.Group();
      const cars = new Instances();
      const cabins = new Instances();
      const poles = new Instances();
      const lamps = new Instances();
      const street = { euc: new Instances(), plane: new Instances() };
      const r = rng(si * 977 + 3);
      layout.roads.minor.concat(layout.roads.major).forEach((rd) => {
        const len = Math.hypot(rd.bx - rd.ax, rd.bz - rd.az);
        const dx = (rd.bx - rd.ax) / len;
        const dz = (rd.bz - rd.az) / len;
        const tc = Math.max(0, Math.min(len, (sx - rd.ax) * dx + (sz - rd.az) * dz));
        if (Math.hypot(rd.ax + dx * tc - sx, rd.az + dz * tc - sz) > R) return; // road never enters the area
        const nx = -dz;
        const nz = dx;
        const rot = Math.atan2(-dz, dx);
        for (let t = 5; t < len - 5; t += 6) {
          const x0 = rd.ax + dx * t;
          const z0 = rd.az + dz * t;
          if (!inArea(x0, z0)) continue;
          const step = Math.round(t / 6);
          [-1, 1].forEach((side) => {
            // parked car in the kerb lane
            if (r() < 0.22) {
              const o = rd.w / 2 - 1.3;
              const x = x0 + nx * o * side;
              const z = z0 + nz * o * side;
              if (!inClear(x, z)) {
                const col = CAR_COLORS[Math.floor(r() * CAR_COLORS.length)];
                cars.push(x, 0.25, z, 4.4, 0.85, 1.8, rot, col);
                cabins.push(x - dx * 0.3, 1.1, z - dz * 0.3, 2.4, 0.6, 1.62, rot);
              }
            }
            // streetlight every ~30 m, alternating sides
            if (step % 5 === 0 && (step / 5) % 2 === (side > 0 ? 0 : 1)) {
              const o = rd.w / 2 + 0.6;
              const x = x0 + nx * o * side;
              const z = z0 + nz * o * side;
              if (landAt(x, z) === LAND && !inClear(x, z)) {
                poles.push(x, 0, z, 0.16, 7.5, 0.16, rot);
                lamps.push(x - nx * side * 0.9, 7.3, z - nz * side * 0.9, 1.8, 0.22, 0.4, rot + Math.PI / 2);
              }
            }
            // dense street trees on the nature strip
            if (step % 2 === 0 && r() < 0.7) {
              const o = rd.w / 2 + 1.6;
              const x = x0 + nx * o * side + dx * 3;
              const z = z0 + nz * o * side + dz * 3;
              if (landAt(x, z) === LAND && !inClear(x, z)) {
                const euc = r() < 0.4;
                const s = 0.65 + r() * 0.5;
                (euc ? street.euc : street.plane).push(x, 0, z, s, s, s, r() * 6.28);
              }
            }
          });
        }
      });
      const add = (inst, geo, mat, g, shadows = true) => {
        const m = inst.build(geo, mat, { shadows });
        if (m) g.add(m);
      };
      add(cars, GEO.box, carMat, extras);
      add(cabins, GEO.box, glassMat, extras, false);
      add(poles, GEO.box, poleMat, extras, false);
      add(lamps, GEO.box, lampMat, extras, false);
      add(street.euc, trees.assets.euc, trees.assets.material, area);
      add(street.plane, trees.assets.plane, trees.assets.material, area);
      area.add(extras);
      this.group.add(area);
      this.areas.push({ x: sx, z: sz, extras });
    });
  }

  update(tx, tz) {
    this.areas.forEach((a) => {
      a.extras.visible = Math.hypot(a.x - tx, a.z - tz) < this.extrasRadius;
    });
  }
}
