import { rng } from '../../../gfx/proctex.js';
import { EXTENT, landAt, LAND, COAST, PARK, WATER, TRACK, hoddle, inHoddle, zoneAt, arterials, arterialClearance } from './land.js';

/*
 * Street network + blocks.
 *  - CBD: the Hoddle Grid (30 m main streets, 9 m "little" streets), rotated ~18°.
 *  - Elsewhere: Melbourne's ~1.6 km (one mile) grid of arterials bounds "superblocks";
 *    each superblock gets its own slightly rotated local street grid, so grids stay loose
 *    and meet at the arterials — as they do in the real city.
 *  - Named arterials (St Kilda Rd, Beach Rd, Bay Rd, Toorak Rd, Punt Rd) on their paths.
 * Roads are clipped where they would cross water, parks or the project sites; blocks are
 * the spaces between roads, so buildings never land on a road.
 */
export const SB = 1600;
const AOFF = 800; // arterial lines at 800 + k·1600 m (keeps the CBD off an arterial)
const LOCAL_W = 11;
const ART_W = 22;
const FOOT = 3.2;

export function buildLayout({ keepClear = [] } = {}) {
  const roads = { major: [], minor: [] };
  const blocks = [];
  const superblocks = [];
  const clear = (x, z) => !keepClear.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);

  // straight road from A to B: sampled every `step`, kept only where passable
  const line = (ax, az, bx, bz, w, list, passable, step = 20) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / step));
    let start = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const ok = passable(x, z) && clear(x, z);
      if (ok && start === null) start = t;
      if ((!ok || i === n) && start !== null) {
        const end = ok ? t : (i - 1) / n;
        if (end - start > 1e-6 && (end - start) * len > 30) {
          list.push({ ax: ax + (bx - ax) * start, az: az + (bz - az) * start, bx: ax + (bx - ax) * end, bz: az + (bz - az) * end, w });
        }
        start = null;
      }
    }
  };

  const onLand = (x, z) => {
    const l = landAt(x, z);
    return l === LAND;
  };
  const arterialOK = (x, z) => {
    const l = landAt(x, z);
    return (l === LAND || l === PARK || l === COAST) && !inHoddle(x, z, -10);
  };

  /* ---- Hoddle Grid ---- */
  const H = hoddle;
  const hp = (u, v) => [H.cx + u * H.ux + v * H.vx, H.cz + u * H.uz + v * H.vz];
  const cbdOK = (x, z) => landAt(x, z) !== WATER;
  for (let k = 0; k <= 4; k++) {
    const v = -H.halfV + k * H.block;
    const [ax, az] = hp(-H.halfU - 160, v);
    const [bx, bz] = hp(H.halfU + 160, v);
    line(ax, az, bx, bz, 30, roads.major, cbdOK);
    if (k < 4) {
      const [cx, cz] = hp(-H.halfU, v + H.block / 2);
      const [dx, dz] = hp(H.halfU, v + H.block / 2);
      line(cx, cz, dx, dz, 9, roads.minor, cbdOK);
    }
  }
  for (let k = 0; k <= 8; k++) {
    const u = -H.halfU + k * H.block;
    const [ax, az] = hp(u, -H.halfV - 160);
    const [bx, bz] = hp(u, H.halfV + 160);
    line(ax, az, bx, bz, 30, roads.major, cbdOK);
  }
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < 4; k++) {
      const u0 = -H.halfU + i * H.block + 15;
      const u1 = u0 + H.block - 30;
      const v0 = -H.halfV + k * H.block;
      // two half-blocks either side of the little street
      [
        [v0 + 15, v0 + H.block / 2 - 4.5],
        [v0 + H.block / 2 + 4.5, v0 + H.block - 15],
      ].forEach(([a, b]) => {
        const [cx, cz] = hp((u0 + u1) / 2, (a + b) / 2);
        blocks.push({
          kind: 'cbd',
          cx,
          cz,
          ax: H.ux,
          az: H.uz,
          lenA: u1 - u0,
          lenB: b - a,
          zone: 'cbd',
          seed: i * 31 + k * 7 + (a > v0 + 50 ? 1 : 0),
          sb: null,
        });
      });
    }
  }

  /* ---- mile-grid arterials ---- */
  for (let x = AOFF + Math.floor((EXTENT.x0 - AOFF) / SB) * SB; x <= EXTENT.x1; x += SB)
    line(x, EXTENT.z0, x, EXTENT.z1, ART_W, roads.major, arterialOK, 25);
  for (let z = AOFF + Math.floor((EXTENT.z0 - AOFF) / SB) * SB; z <= EXTENT.z1; z += SB)
    line(EXTENT.x0, z, EXTENT.x1, z, ART_W, roads.major, arterialOK, 25);

  /* ---- named arterials ---- */
  arterials.forEach((a) => {
    for (let i = 0; i < a.xz.length - 1; i++) {
      const [ax, az] = a.xz[i];
      const [bx, bz] = a.xz[i + 1];
      line(ax, az, bx, bz, a.width, roads.major, (x, z) => landAt(x, z) !== WATER && landAt(x, z) !== TRACK, 15);
    }
  });

  /* ---- superblocks with loose local grids ---- */
  for (let x0 = AOFF + Math.floor((EXTENT.x0 - AOFF) / SB) * SB; x0 < EXTENT.x1; x0 += SB) {
    for (let z0 = AOFF + Math.floor((EXTENT.z0 - AOFF) / SB) * SB; z0 < EXTENT.z1; z0 += SB) {
      const cx = x0 + SB / 2;
      const cz = z0 + SB / 2;
      // skip superblocks that are all water
      let land = 0;
      for (let s = 0; s < 25; s++) if (landAt(x0 + ((s % 5) + 0.5) * (SB / 5), z0 + (Math.floor(s / 5) + 0.5) * (SB / 5)) !== WATER) land++;
      if (!land) continue;
      const r = rng(Math.floor(cx * 7.31 + cz * 3.17));
      const zone = zoneAt(cx, cz);
      const rot = (r() - 0.5) * 0.2 + (Math.hypot(cx, cz) < 6000 ? -0.1 : 0);
      const long = r() < 0.5; // which way the long blocks run
      const su = long ? 190 + r() * 60 : 90 + r() * 30;
      const sv = long ? 90 + r() * 30 : 190 + r() * 60;
      const sb = { cx, cz, x0, z0, rot, su, sv, zone, index: superblocks.length, roads: [] };
      superblocks.push(sb);
      const ax = Math.cos(rot);
      const az = Math.sin(rot);
      const bx = -az;
      const bz = ax;
      const inner = SB / 2 - ART_W / 2 - FOOT;
      const inside = (x, z) => Math.abs(x - cx) < inner && Math.abs(z - cz) < inner;
      const localOK = (x, z) => inside(x, z) && onLand(x, z) && !inHoddle(x, z, 25) && arterialClearance(x, z) > -2;
      const ou = (r() - 0.5) * su;
      const ov = (r() - 0.5) * sv;
      const E = SB * 0.75;
      const aLines = [];
      const bLines = [];
      for (let a = ou - Math.ceil(E / su) * su; a <= E; a += su) aLines.push(a);
      for (let b = ov - Math.ceil(E / sv) * sv; b <= E; b += sv) bLines.push(b);
      const before = roads.minor.length;
      aLines.forEach((a) =>
        line(cx + ax * a - bx * E, cz + az * a - bz * E, cx + ax * a + bx * E, cz + az * a + bz * E, LOCAL_W, roads.minor, localOK),
      );
      bLines.forEach((b) =>
        line(cx + bx * b - ax * E, cz + bz * b - az * E, cx + bx * b + ax * E, cz + bz * b + az * E, LOCAL_W, roads.minor, localOK),
      );
      sb.roads = roads.minor.slice(before);

      const hw = LOCAL_W / 2 + FOOT;
      for (let i = 0; i < aLines.length - 1; i++) {
        for (let j = 0; j < bLines.length - 1; j++) {
          const a0 = aLines[i] + hw;
          const a1 = aLines[i + 1] - hw;
          const b0 = bLines[j] + hw;
          const b1 = bLines[j + 1] - hw;
          const ca = (a0 + a1) / 2;
          const cb = (b0 + b1) / 2;
          const bcx = cx + ax * ca + bx * cb;
          const bcz = cz + az * ca + bz * cb;
          if (Math.abs(bcx - cx) > SB / 2 + 60 || Math.abs(bcz - cz) > SB / 2 + 60) continue;
          const la = a1 - a0;
          const lb = b1 - b0;
          // long axis first
          const blk =
            la >= lb ? { cx: bcx, cz: bcz, ax, az, lenA: la, lenB: lb } : { cx: bcx, cz: bcz, ax: bx, az: bz, lenA: lb, lenB: la };
          blocks.push({
            ...blk,
            kind: 'local',
            zone: zoneAt(bcx, bcz),
            seed: Math.floor(bcx * 13.7 + bcz * 5.3),
            sb: sb.index,
            inner: { cx, cz, half: inner },
          });
        }
      }
    }
  }
  return { roads, blocks, superblocks, footpath: FOOT };
}

/** Is a lot centre usable (on land, inside its superblock, off the named arterials)? */
export function lotOK(block, x, z, clearance = 6) {
  const l = landAt(x, z);
  if (l !== LAND) return false;
  if (block.inner && (Math.abs(x - block.inner.cx) > block.inner.half || Math.abs(z - block.inner.cz) > block.inner.half)) return false;
  if (block.kind !== 'cbd' && inHoddle(x, z, 20)) return false;
  return arterialClearance(x, z) > clearance;
}
