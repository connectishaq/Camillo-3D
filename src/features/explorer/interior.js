import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { metricBoxUV, metricPlaneUV } from './textures.js';

const FLOOR_Y = 0.36; // top of slab
const WALL_H = 2.7;
const WALL_T = 0.12;
const DOOR = 0.95;

/**
 * Builds an indicative interior fit-out for one level. Built on demand when a floor is
 * opened, and disposed when it is closed, so the explorer stays light.
 *
 * Rooms are rectangles { type, name, x0, x1, z0, z1, facing } where `facing` (+1 / -1)
 * points toward the window wall along z.
 */
export function buildInterior(floor, mats) {
  const { w, d, data } = floor;
  const iw = w - 0.5;
  const id = d - 0.5;
  const inner = { x0: -iw / 2, x1: iw / 2, z0: -id / 2, z1: id / 2 };
  const plan = planFloor(data, inner);

  const group = new THREE.Group();
  const walls = [];
  const labels = [];

  // Floor finish
  const finish = new THREE.Mesh(metricPlaneUV(new THREE.PlaneGeometry(iw, id), iw, id), mats.floor);
  finish.rotation.x = -Math.PI / 2;
  finish.position.y = FLOOR_Y + 0.02;
  finish.receiveShadow = true;
  group.add(finish);

  plan.rooms.forEach((r) => {
    if (r.type === 'bath' || r.type === 'corridor' || r.type === 'lobby') {
      const t = new THREE.Mesh(metricPlaneUV(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), r.x1 - r.x0, r.z1 - r.z0), mats.tile);
      t.rotation.x = -Math.PI / 2;
      t.position.set((r.x0 + r.x1) / 2, FLOOR_Y + 0.03, (r.z0 + r.z1) / 2);
      t.receiveShadow = true;
      group.add(t);
    }
    addRoomWalls(group, walls, r, inner, mats);
    furnish(group, r, mats);
  });

  plan.cores.forEach((c) => {
    const core = solid(c.w, WALL_H, c.d, mats.core, c.x, FLOOR_Y, c.z);
    group.add(core);
    walls.push(core);
  });

  // Labels — per room when legible, per residence when the floor is busy
  const busy = plan.rooms.length > 26;
  const labelTargets = busy ? plan.units : plan.rooms.filter((r) => r.type !== 'corridor');
  labelTargets.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'room-label';
    el.textContent = busy && plan.units.length > 6 ? String(i + 1).padStart(2, '0') : r.name;
    const obj = new CSS2DObject(el);
    obj.position.set((r.x0 + r.x1) / 2, FLOOR_Y + 1.3, (r.z0 + r.z1) / 2);
    group.add(obj);
    labels.push(obj);
  });

  // First-person viewpoint: back of the first living space, looking out the window
  const living = plan.rooms.find((r) => ['living', 'lobby', 'rumpus'].includes(r.type)) || plan.rooms[0];
  const rd = living.z1 - living.z0;
  const cx = (living.x0 + living.x1) / 2;
  const cz = (living.z0 + living.z1) / 2;
  const eye = {
    position: new THREE.Vector3(cx - (living.x1 - living.x0) * 0.2, FLOOR_Y + 1.6, cz - living.facing * rd * 0.36),
    target: new THREE.Vector3(cx + (living.x1 - living.x0) * 0.1, FLOOR_Y + 1.35, cz + living.facing * rd * 0.6),
  };

  return { group, walls, labels, eye, summary: plan.summary };
}

export function disposeInterior(interior) {
  interior.labels.forEach((l) => l.element.remove());
  interior.group.traverse((o) => o.geometry && o.geometry.dispose());
  interior.group.removeFromParent();
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

function planFloor(data, inner) {
  const rooms = [];
  const units = [];
  const cores = [];
  const iw = inner.x1 - inner.x0;
  const n = data.units || 1;

  const pushUnit = (rect, facing, i) => {
    const list = unitRooms(rect, facing);
    rooms.push(...list);
    units.push({ ...rect, name: `Residence ${String(i + 1).padStart(2, '0')}`, facing, rooms: list });
  };

  switch (data.program) {
    case 'rumpus':
      rooms.push(
        ...zoneRooms(
          inner,
          1,
          0.55,
          [
            ['rumpus', 'Rumpus room', 0.55],
            ['gym', 'Sports room', 0.45],
          ],
          [
            ['gym', 'Gymnastics', 0.45],
            ['sauna', 'Infrared sauna', 0.2],
            ['store', 'Wellness', 0.35],
          ],
        ),
      );
      break;
    case 'living':
      rooms.push(
        ...zoneRooms(
          inner,
          1,
          0.58,
          [
            ['living', 'Living', 0.42],
            ['dining', 'Dining', 0.26],
            ['kitchen', 'Kitchen', 0.32],
          ],
          [
            ['lounge', 'Formal lounge', 0.45],
            ['bath', 'Powder', 0.15],
            ['entry', 'Entry & stair', 0.4],
          ],
        ),
      );
      break;
    case 'bedrooms':
      rooms.push(
        ...zoneRooms(
          inner,
          1,
          0.55,
          [
            ['bed', 'Main bedroom', 0.46],
            ['bed', 'Bedroom 2', 0.27],
            ['bed', 'Bedroom 3', 0.27],
          ],
          [
            ['bath', 'Ensuite', 0.28],
            ['robe', 'Walk-in robe', 0.22],
            ['bath', 'Bathroom', 0.2],
            ['study', 'Study', 0.3],
          ],
        ),
      );
      break;
    case 'lobby': {
      const lobbyW = iw * 0.36;
      const lobby = { type: 'lobby', name: 'Entrance lobby', x0: -lobbyW / 2, x1: lobbyW / 2, z0: inner.z0 + 3, z1: inner.z1, facing: 1 };
      rooms.push(lobby);
      rooms.push({ type: 'corridor', name: 'Lifts', x0: -lobbyW / 2, x1: lobbyW / 2, z0: inner.z0, z1: inner.z0 + 3, facing: 1 });
      cores.push({ x: 0, z: inner.z0 + 1.5, w: Math.min(4, lobbyW * 0.6), d: 2.6 });
      const left = Math.ceil(n / 2);
      const right = n - left;
      let idx = 0;
      grid({ ...inner, x1: -lobbyW / 2 }, left).forEach((r) => pushUnit(r, r.facing, idx++, n));
      grid({ ...inner, x0: lobbyW / 2 }, right).forEach((r) => pushUnit(r, r.facing, idx++, n));
      break;
    }
    default: {
      // apartments / penthouse / whole-floor
      const rows = n > 4 ? 2 : 1;
      const corridorD = 1.8;
      const front = Math.ceil(n / rows);
      const back = n - front;
      let idx = 0;
      if (rows === 1) {
        const cz0 = inner.z0;
        rooms.push({
          type: 'corridor',
          name: n === 1 ? 'Private lift lobby' : 'Corridor',
          x0: inner.x0,
          x1: inner.x1,
          z0: cz0,
          z1: cz0 + corridorD,
          facing: 1,
        });
        cores.push({ x: 0, z: cz0 + corridorD / 2, w: 3.2, d: corridorD - 0.2 });
        splitX({ ...inner, z0: cz0 + corridorD }, front).forEach((r) => pushUnit(r, 1, idx++, n));
      } else {
        rooms.push({ type: 'corridor', name: 'Corridor', x0: inner.x0, x1: inner.x1, z0: -corridorD / 2, z1: corridorD / 2, facing: 1 });
        cores.push({ x: 0, z: 0, w: 3.4, d: corridorD - 0.2 });
        splitX({ ...inner, z0: corridorD / 2 }, front).forEach((r) => pushUnit(r, 1, idx++, n));
        splitX({ ...inner, z1: -corridorD / 2 }, back).forEach((r) => pushUnit(r, -1, idx++, n));
      }
    }
  }

  return { rooms, units, cores, summary: summarise(data, rooms, units) };
}

/** Rooms for one residence, split into a window-side living zone and a bedroom zone. */
function unitRooms(rect, facing) {
  const uw = rect.x1 - rect.x0;
  let front;
  let back;
  if (uw >= 13) {
    front = [
      ['living', 'Living', 0.45],
      ['dining', 'Dining', 0.2],
      ['kitchen', 'Kitchen', 0.35],
    ];
    back = [
      ['bed', 'Main bedroom', 0.28],
      ['bath', 'Ensuite', 0.14],
      ['bed', 'Bedroom 2', 0.2],
      ['bath', 'Bathroom', 0.13],
      ['bed', 'Bedroom 3', 0.25],
    ];
  } else if (uw >= 7.5) {
    front = [['living', 'Living & kitchen', 1]];
    back = [
      ['bed', 'Main bedroom', 0.4],
      ['bath', 'Bath', 0.22],
      ['bed', 'Bedroom 2', 0.38],
    ];
  } else if (uw >= 5) {
    front = [['living', 'Living & kitchen', 1]];
    back = [
      ['bed', 'Bedroom', 0.6],
      ['bath', 'Bath', 0.4],
    ];
  } else {
    front = [['living', 'Studio', 1]];
    back = [['bath', 'Bath', 1]];
  }
  const list = zoneRooms(rect, facing, 0.56, front, back);
  // Living rooms without a separate kitchen get a kitchen run
  if (!list.some((r) => r.type === 'kitchen')) list.forEach((r) => r.type === 'living' && (r.kitchen = true));
  return list;
}

/** Splits a rect into a front (window) zone and a back zone, each divided along x. */
function zoneRooms(rect, facing, frontRatio, front, back) {
  const depth = rect.z1 - rect.z0;
  const split = facing > 0 ? rect.z1 - depth * frontRatio : rect.z0 + depth * frontRatio;
  const frontRect = facing > 0 ? { ...rect, z0: split } : { ...rect, z1: split };
  const backRect = facing > 0 ? { ...rect, z1: split } : { ...rect, z0: split };
  const out = [];
  const lay = (r, list, zone) => {
    let x = r.x0;
    const W = r.x1 - r.x0;
    list.forEach(([type, name, frac]) => {
      const x1 = x + W * frac;
      out.push({ type, name, x0: x, x1, z0: r.z0, z1: r.z1, facing, zone });
      x = x1;
    });
  };
  lay(frontRect, front, 'front');
  lay(backRect, back, 'back');
  return out;
}

function splitX(rect, n) {
  if (n <= 0) return [];
  const W = (rect.x1 - rect.x0) / n;
  return Array.from({ length: n }, (_, i) => ({ ...rect, x0: rect.x0 + W * i, x1: rect.x0 + W * (i + 1) }));
}

/** Grid a rect into k units, each facing the nearest long façade. */
function grid(rect, k) {
  if (k <= 0) return [];
  const rd = rect.z1 - rect.z0;
  const rows = k === 1 ? 1 : 2;
  const perRow = Math.ceil(k / rows);
  const out = [];
  let left = k;
  for (let r = 0; r < rows; r++) {
    const z0 = rect.z0 + (rd / rows) * r;
    const z1 = z0 + rd / rows;
    const count = Math.min(perRow, left);
    left -= count;
    splitX({ ...rect, z0, z1 }, count).forEach((u) => out.push({ ...u, facing: (z0 + z1) / 2 >= 0 ? 1 : -1 }));
  }
  return out.length ? out : [{ ...rect, facing: 1 }];
}

function summarise(data, rooms, units) {
  const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0);
  const fmt = (m) => `${Math.round(m)} m²`;
  if (!units.length || units.length <= 1) {
    const list = (units[0]?.rooms || rooms).filter((r) => r.type !== 'corridor');
    return list.slice(0, 9).map((r) => [r.name, fmt(area(r))]);
  }
  const typical = units[0];
  const beds = typical.rooms.filter((r) => r.type === 'bed').length;
  const rows = [
    ['Residences on this level', String(units.length)],
    ['Typical residence', `≈ ${fmt(area(typical))}`],
    ['Bedrooms (typical)', String(beds || 'Studio')],
  ];
  const lobby = rooms.find((r) => r.type === 'lobby');
  if (lobby) rows.unshift(['Entrance lobby', fmt(area(lobby))]);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function solid(w, h, d, mat, x, y, z) {
  const g = metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
  g.translate(0, h / 2, 0); // pivot at the base so walls can "grow" up
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function addRoomWalls(group, walls, r, inner, mats) {
  if (r.type === 'corridor') return;
  const eps = 0.05;
  const onEdge = {
    n: Math.abs(r.z0 - inner.z0) < eps,
    s: Math.abs(r.z1 - inner.z1) < eps,
    w: Math.abs(r.x0 - inner.x0) < eps,
    e: Math.abs(r.x1 - inner.x1) < eps,
  };
  // door on the side facing the other zone
  const doorSide = r.zone === 'front' ? (r.facing > 0 ? 'n' : 's') : r.facing > 0 ? 's' : 'n';
  const add = (x0, z0, x1, z1, door) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const horizontal = Math.abs(z1 - z0) < 0.01;
    const segs =
      door && len > DOOR + 0.8
        ? [
            [0, (len - DOOR) / 2],
            [(len + DOOR) / 2, len],
          ]
        : [[0, len]];
    segs.forEach(([a, b]) => {
      const l = b - a;
      const mid = (a + b) / 2;
      const x = horizontal ? x0 + mid : x0;
      const z = horizontal ? z0 : z0 + mid;
      const m = solid(horizontal ? l : WALL_T, WALL_H, horizontal ? WALL_T : l, mats.wall, x, FLOOR_Y, z);
      group.add(m);
      walls.push(m);
    });
  };
  if (!onEdge.n) add(r.x0, r.z0, r.x1, r.z0, doorSide === 'n');
  if (!onEdge.s) add(r.x0, r.z1, r.x1, r.z1, doorSide === 's');
  if (!onEdge.w) add(r.x0, r.z0, r.x0, r.z1, false);
  if (!onEdge.e) add(r.x1, r.z0, r.x1, r.z1, false);
}

/** Places simple furniture blocks in room-local space (u across, v toward the window). */
function furnish(group, r, mats) {
  const rw = r.x1 - r.x0;
  const rd = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const put = (w, h, d, mat, u, v, y = 0) => {
    const m = solid(w, h, d, mat, cx + u, FLOOR_Y + y, cz + r.facing * v);
    group.add(m);
    return m;
  };
  const plant = (u, v) => {
    put(0.45, 0.45, 0.45, mats.pot, u, v);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mats.plant);
    leaf.position.set(cx + u, FLOOR_Y + 0.95, cz + r.facing * v);
    leaf.castShadow = true;
    group.add(leaf);
  };
  const fit = (x, max) => Math.min(x, max);

  switch (r.type) {
    case 'living': {
      const sw = fit(2.4, rw * 0.45);
      put(sw * 1.3, 0.02, fit(2.4, rd * 0.45), mats.rug, -rw * 0.12, rd * 0.08);
      put(sw, 0.8, 0.9, mats.fabric, -rw * 0.12, -rd * 0.08);
      put(0.9, 0.8, 0.9, mats.fabricLight, -rw * 0.12 + sw * 0.75, rd * 0.18);
      put(1.1, 0.38, 0.6, mats.timber, -rw * 0.12, rd * 0.16);
      if (r.kitchen) {
        const kl = fit(3.2, rw * 0.55);
        put(kl, 0.92, 0.62, mats.stone, rw * 0.18, -rd / 2 + 0.4);
        put(kl * 0.7, 0.92, 0.9, mats.stone, rw * 0.18, -rd / 2 + 1.8);
      }
      if (rw > 5) plant(rw / 2 - 0.6, rd / 2 - 0.6);
      break;
    }
    case 'kitchen': {
      const kl = fit(4, rw * 0.8);
      put(kl, 0.92, 0.62, mats.stone, 0, -rd / 2 + 0.4);
      put(kl * 0.7, 0.92, 1.0, mats.stone, 0, 0);
      break;
    }
    case 'dining': {
      put(fit(2.4, rw * 0.6), 0.75, 1.0, mats.timber, 0, 0);
      [-0.8, 0, 0.8].forEach((u) => {
        put(0.45, 0.5, 0.45, mats.black, u, 0.75);
        put(0.45, 0.5, 0.45, mats.black, u, -0.75);
      });
      break;
    }
    case 'bed': {
      const bw = fit(1.7, rw * 0.6);
      put(bw, 0.55, 2.1, mats.linen, 0, -rd / 2 + 1.3);
      put(bw + 0.2, 1.0, 0.12, mats.timber, 0, -rd / 2 + 0.2);
      put(0.45, 0.5, 0.4, mats.timber, bw / 2 + 0.4, -rd / 2 + 0.4);
      put(0.45, 0.5, 0.4, mats.timber, -bw / 2 - 0.4, -rd / 2 + 0.4);
      break;
    }
    case 'bath': {
      put(fit(1.4, rw * 0.7), 0.85, 0.5, mats.stone, 0, -rd / 2 + 0.35);
      if (rd > 2.4) put(fit(1.7, rw * 0.8), 0.55, 0.8, mats.linen, 0, rd / 2 - 0.6);
      break;
    }
    case 'study': {
      put(fit(1.6, rw * 0.7), 0.75, 0.7, mats.timber, 0, rd / 2 - 0.6);
      put(0.55, 0.9, 0.55, mats.black, 0, rd / 2 - 1.3);
      break;
    }
    case 'robe': {
      put(rw * 0.8, 2.3, 0.6, mats.timber, 0, -rd / 2 + 0.4);
      break;
    }
    case 'lounge': {
      put(fit(2.6, rw * 0.5), 0.8, 0.9, mats.fabricLight, 0, -rd * 0.15);
      put(fit(2.6, rw * 0.5), 0.8, 0.9, mats.fabricLight, 0, rd * 0.25);
      put(1.2, 0.4, 0.7, mats.stone, 0, rd * 0.05);
      break;
    }
    case 'lobby': {
      put(fit(3.6, rw * 0.5), 1.05, 0.8, mats.stone, 0, -rd * 0.2);
      put(2.2, 0.75, 0.85, mats.fabric, -rw * 0.25, rd * 0.2);
      put(2.2, 0.75, 0.85, mats.fabric, rw * 0.25, rd * 0.2);
      plant(-rw / 2 + 0.8, rd / 2 - 0.8);
      plant(rw / 2 - 0.8, rd / 2 - 0.8);
      break;
    }
    case 'rumpus': {
      put(fit(3.6, rw * 0.5), 0.8, 0.95, mats.fabric, 0, -rd * 0.1);
      put(0.95, 0.8, 2.2, mats.fabric, -fit(3.6, rw * 0.5) / 2, rd * 0.1);
      // The pool above shines through a glazed ceiling panel
      const glow = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.5, 0.06, rd * 0.35), mats.glow);
      glow.position.set(cx, FLOOR_Y + WALL_H - 0.05, cz + r.facing * rd * 0.2);
      group.add(glow);
      break;
    }
    case 'gym': {
      put(rw * 0.6, 0.05, rd * 0.5, mats.rug, 0, 0);
      put(0.6, 1.6, 0.6, mats.black, rw / 2 - 0.6, -rd / 2 + 0.6);
      break;
    }
    case 'sauna': {
      put(rw * 0.8, 2.2, rd * 0.6, mats.timber, 0, 0);
      break;
    }
    case 'store':
    case 'entry': {
      plant(0, 0);
      break;
    }
    default:
      break;
  }
}
