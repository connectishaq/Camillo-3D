/**
 * Simplified Melbourne geography for the self-contained 3D city.
 * Hand-traced, approximate [lng, lat] outlines — stylised, not survey accurate.
 */

export const ORIGIN = [144.9631, -37.8136]; // Melbourne CBD
const COS = Math.cos((ORIGIN[1] * Math.PI) / 180);

/** [lng, lat] → local metres. x = east, z = south (north is -z). */
export const toXZ = ([lng, lat]) => [(lng - ORIGIN[0]) * 111320 * COS, -(lat - ORIGIN[1]) * 110540];

/** Port Phillip Bay (north shore) as a closed water polygon. */
export const BAY = [
  [144.6, -37.86],
  [144.8, -37.862],
  [144.86, -37.856],
  [144.895, -37.862],
  [144.905, -37.868],
  [144.913, -37.858],
  [144.912, -37.846],
  [144.922, -37.8425],
  [144.931, -37.8445],
  [144.94, -37.848],
  [144.955, -37.853],
  [144.966, -37.859],
  [144.973, -37.866],
  [144.978, -37.874],
  [144.983, -37.884],
  [144.986, -37.897],
  [144.987, -37.91],
  [144.99, -37.924],
  [144.996, -37.938],
  [144.9995, -37.948],
  [145.003, -37.958],
  [145.012, -37.97],
  [145.025, -37.982],
  [145.04, -37.992],
  [145.06, -38.005],
  [145.1, -38.3],
  [144.6, -38.3],
];

/** Rivers as polylines with a width in metres. */
export const RIVERS = [
  {
    name: 'Yarra River',
    width: 90,
    path: [
      [144.908, -37.843],
      [144.905, -37.832],
      [144.912, -37.825],
      [144.925, -37.822],
      [144.938, -37.8205],
      [144.947, -37.8215],
      [144.955, -37.8215],
      [144.962, -37.8195],
      [144.97, -37.8195],
      [144.978, -37.8215],
      [144.986, -37.8255],
      [144.994, -37.8275],
      [144.999, -37.834],
      [145.004, -37.838],
      [145.012, -37.836],
      [145.015, -37.829],
      [145.02, -37.826],
      [145.022, -37.818],
      [145.018, -37.812],
      [145.012, -37.808],
      [145.006, -37.8],
      [145.01, -37.792],
      [145.018, -37.786],
      [145.024, -37.782],
      [145.03, -37.786],
      [145.04, -37.79],
      [145.05, -37.788],
      [145.06, -37.783],
      [145.072, -37.777],
    ],
  },
  {
    name: 'Maribyrnong River',
    width: 60,
    path: [
      [144.913, -37.824],
      [144.903, -37.812],
      [144.895, -37.797],
      [144.904, -37.786],
      [144.899, -37.772],
      [144.888, -37.76],
      [144.875, -37.752],
    ],
  },
];

/** Ellipses: [lng, lat, radiusX m, radiusZ m, rotation rad] */
export const LAKES = [[144.9725, -37.8445, 380, 820, 0.25]];

export const PARKS = [
  [144.9725, -37.8445, 720, 1250, 0.25], // Albert Park
  [144.98, -37.8305, 560, 430, 0], // Royal Botanic Gardens
  [144.9725, -37.8255, 300, 420, 0], // Kings Domain
  [144.98, -37.8125, 210, 320, 0], // Fitzroy Gardens
  [144.9715, -37.8055, 190, 240, 0], // Carlton Gardens
  [144.961, -37.784, 360, 650, 0], // Princes Park
  [144.95, -37.789, 700, 720, 0], // Royal Park
  [145.005, -37.795, 620, 600, 0], // Yarra Bend
  [144.9555, -37.8105, 150, 150, 0], // Flagstaff Gardens
  [144.9305, -37.767, 360, 260, 0.4], // Moonee Valley Racecourse
  [144.912, -37.789, 460, 360, 0.3], // Flemington Racecourse
  [144.983, -37.82, 360, 260, 0], // Yarra Park / MCG
];

export const SUBURBS = [
  ['Melbourne CBD', [144.9631, -37.8136]],
  ['Docklands', [144.945, -37.8165]],
  ['Southbank', [144.962, -37.8245]],
  ['Port Melbourne', [144.935, -37.836]],
  ['St Kilda', [144.981, -37.864]],
  ['South Yarra', [144.99, -37.839]],
  ['Toorak', [145.018, -37.842]],
  ['Richmond', [145.0, -37.818]],
  ['Carlton', [144.967, -37.798]],
  ['Fitzroy', [144.979, -37.8]],
  ['Brunswick', [144.962, -37.768]],
  ['Moonee Ponds', [144.919, -37.765]],
  ['Eaglemont', [145.07, -37.767]],
  ['Elwood', [144.991, -37.882]],
  ['Brighton', [145.002, -37.908]],
  ['Sandringham', [145.013, -37.955]],
  ['Williamstown', [144.895, -37.855]],
  ['Port Phillip Bay', [144.93, -37.9]],
  ['Kew', [145.035, -37.805]],
  ['Footscray', [144.9, -37.8]],
];

/** Hoddle Grid: centre, rotation (Collins St runs ~18° north of east), half extents in metres. */
export const HODDLE = { center: [144.9631, -37.8136], angle: (18 * Math.PI) / 180, halfU: 804, halfV: 402, block: 201 };

/** High-rise precincts outside the Hoddle Grid: [lng, lat, radius m]. */
export const TOWER_ZONES = [
  [144.9625, -37.8255, 650], // Southbank
  [144.944, -37.816, 700], // Docklands
  [144.94, -37.829, 380], // South Wharf / Fishermans Bend edge
];

/** Named arterials along their real rough paths: { name, width m, path [lng, lat][] }. */
export const ARTERIALS = [
  {
    name: 'St Kilda Rd',
    width: 46,
    boulevard: true,
    path: [
      [144.969, -37.819],
      [144.97, -37.826],
      [144.9745, -37.8385],
      [144.9795, -37.848],
      [144.983, -37.8555],
      [144.99, -37.868],
      [144.996, -37.88],
      [144.9985, -37.892],
    ],
  },
  {
    name: 'Punt Rd',
    width: 28,
    path: [
      [144.986, -37.8],
      [144.986, -37.82],
      [144.987, -37.83],
      [144.988, -37.84],
      [144.987, -37.85],
      [144.985, -37.856],
    ],
  },
  {
    name: 'Toorak Rd',
    width: 24,
    path: [
      [144.9745, -37.8385],
      [144.992, -37.8395],
      [145.01, -37.842],
      [145.03, -37.844],
      [145.06, -37.847],
      [145.09, -37.849],
    ],
  },
  {
    name: 'Bay Rd',
    width: 24,
    path: [
      [145.003, -37.9505],
      [145.012, -37.953],
      [145.024, -37.955],
      [145.04, -37.9565],
      [145.06, -37.958],
      [145.08, -37.959],
    ],
  },
  // Beach Rd / Marine Pde hug the shore; offset inland from the coastline at runtime
  { name: 'Beach Rd', width: 22, coast: [12, 22], inland: 120 },
];

/** Piers: [from, to] as [lng, lat], width m. */
export const PIERS = [
  { name: 'Station Pier', from: [144.9313, -37.8441], to: [144.9286, -37.8498], width: 28, sheds: true },
  { name: 'St Kilda Pier', from: [144.9733, -37.8628], to: [144.9683, -37.8641], width: 10 },
  { name: 'Brighton Pier', from: [144.9868, -37.9087], to: [144.9832, -37.9098], width: 6 },
];

/** Racecourses get a track ring: [lng, lat, radiusX, radiusZ, rotation]. */
export const RACECOURSES = [
  [144.9305, -37.767, 330, 230, 0.4], // Moonee Valley
  [144.912, -37.789, 430, 330, 0.3], // Flemington
  [145.0405, -37.8805, 440, 330, 0.25], // Caulfield
];

/* ---------- geometry helpers (metres) ---------- */

export function pointInPolygon([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToPolyline([x, z], line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

export function inEllipse([x, z], [cx, cz, rx, rz, rot]) {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const dx = x - cx;
  const dz = z - cz;
  const u = dx * c - dz * s;
  const v = dx * s + dz * c;
  return (u * u) / (rx * rx) + (v * v) / (rz * rz) <= 1;
}
