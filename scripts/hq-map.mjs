/*
 * The About section's 2D map around the head office, from OpenStreetMap data:
 *   public/images/map/hq-map-<w>.webp  land, the bay, rivers and lakes, parks, beaches, streets
 *                                  and rail, in the site's quiet palette (no text: the page sets
 *                                  the labels in its own font). Drawn as an SVG, then saved as
 *                                  pictures: a detailed SVG is redrawn on the page's main thread
 *                                  and stutters the scroll, a picture is decoded off it.
 *   src/data/hq-map.json           the map's size and where each label goes (% of the map)
 * The area and the labels are in src/data/hq-map.js. Run `npm run map` after changing them.
 * The OSM data is downloaded once (Overpass API) and kept in .cache/; `--fresh` downloads again.
 * Map data © OpenStreetMap contributors (ODbL): the page credits it under the map.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { hqMap } from '../src/data/hq-map.js';
import { office } from '../src/data/cameras.js';

const root = path.resolve(import.meta.dirname, '..');
const { west, east, north, south } = hqMap.bbox;

/* ---------- data ---------- */
const cacheFile = path.join(root, '.cache/osm-hq-map.json');
async function osm() {
  if (fs.existsSync(cacheFile) && !process.argv.includes('--fresh')) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const b = `(${south - 0.004},${west - 0.004},${north + 0.004},${east + 0.004})`;
  const q = `[out:json][timeout:120];(
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]${b};
    way["railway"~"^(rail|light_rail|tram)$"]${b};
    way["leisure"~"^(park|golf_course|garden|pitch|nature_reserve|stadium)$"]${b};
    relation["leisure"~"^(park|golf_course|nature_reserve)$"]${b};
    way["landuse"~"^(grass|recreation_ground|village_green|forest)$"]${b};
    way["natural"~"^(water|coastline|wood|scrub|beach|sand)$"]${b};
    relation["natural"="water"]${b};
    way["man_made"="pier"]${b};
  );out geom;`;
  console.log('Downloading OpenStreetMap data…');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'camillo-3d map build' },
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(`Overpass: HTTP ${res.status}`);
  const data = await res.json();
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(data));
  return data;
}

/* ---------- projection: metres, scaled so the map is 1000 units tall ---------- */
const COS = Math.cos((((north + south) / 2) * Math.PI) / 180);
const metresW = (east - west) * 111320 * COS;
const metresH = (north - south) * 110540;
const K = 1000 / metresH;
const W = Math.round(metresW * K);
const H = 1000;
const project = ([lng, lat]) => [(lng - west) * 111320 * COS * K, (north - lat) * 110540 * K];
const pt = (g) => project([g.lon, g.lat]);

/* ---------- geometry helpers ---------- */
// Douglas–Peucker, to drop points the eye can't see at this scale
function simplify(points, tol = 0.6) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay);
    let max = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      // distance from the chord, or from its start when it has none (a closed ring's two ends)
      const d = len
        ? Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len
        : Math.hypot(points[i][0] - ax, points[i][1] - ay);
      if (d > max) [max, at] = [d, i];
    }
    if (max > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
// whole units (a map unit is ~5.5 m) as relative steps: small numbers, a small file
const pathD = (points, close) => {
  const p = simplify(points, 0.9).map(([x, y]) => [Math.round(x), Math.round(y)]);
  const steps = p
    .slice(1)
    .map(([x, y], i) => [x - p[i][0], y - p[i][1]])
    .filter(([dx, dy]) => dx || dy);
  if (!steps.length) return '';
  const num = (v) => (v < 0 ? String(v) : ` ${v}`);
  return (
    `M${p[0][0]} ${p[0][1]}l` +
    steps
      .map(([dx, dy]) => `${num(dx)}${num(dy)}`)
      .join('')
      .replace(/^ /, '') +
    (close ? 'z' : '')
  );
};
// a polygon's area (map units²), to skip specks too small to see
const area = (points) =>
  Math.abs(points.reduce((sum, [x, y], i) => sum + x * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * y, 0)) / 2;
const margin = 60;
const onMap = (points) => points.some(([x, y]) => x > -margin && x < W + margin && y > -margin && y < H + margin);

// joins open ways (e.g. a multipolygon's outer members) into closed rings by their end points
function rings(ways) {
  const open = ways.map((w) => w.slice());
  const out = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  while (open.length) {
    let ring = open.shift();
    let grew = true;
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        if (same(ring.at(-1), w[0])) ring = ring.concat(w.slice(1));
        else if (same(ring.at(-1), w.at(-1))) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(ring);
  }
  return out;
}

function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * The sea: OSM's coastline is a line with the land on its left. Its stretch across the map is
 * closed round the map's frame, on whichever side holds a known point out in the bay.
 */
function sea(coastWays, seaPoint) {
  const line = rings(coastWays.map((w) => w.map(pt))).sort((a, b) => b.length - a.length)[0];
  const box = { x0: -margin, y0: -margin, x1: W + margin, y1: H + margin };
  const inBox = ([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  // the longest run of the coastline inside the frame
  let best = [];
  let run = [];
  for (const p of line) {
    if (inBox(p)) run.push(p);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  if (run.length > best.length) best = run;
  // push its ends out to the frame, then go round the frame one way or the other
  const toEdge = ([x, y]) => {
    const d = [x - box.x0, box.x1 - x, y - box.y0, box.y1 - y];
    const i = d.indexOf(Math.min(...d));
    return i === 0 ? [box.x0, y] : i === 1 ? [box.x1, y] : i === 2 ? [x, box.y0] : [x, box.y1];
  };
  const a = toEdge(best[0]);
  const b = toEdge(best.at(-1));
  const corners = [
    [box.x0, box.y0],
    [box.x1, box.y0],
    [box.x1, box.y1],
    [box.x0, box.y1],
  ];
  // position round the frame, clockwise from the top-left corner
  const per = ([x, y]) => {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    if (y === box.y0) return x - box.x0;
    if (x === box.x1) return w + (y - box.y0);
    if (y === box.y1) return w + h + (box.x1 - x);
    return 2 * w + h + (box.y1 - y);
  };
  const total = 2 * (box.x1 - box.x0 + box.y1 - box.y0);
  // the frame's corners met going round from `from` to `to`, clockwise (1) or anticlockwise (-1)
  const walk = (from, to, dir) => {
    const ahead = (p) => ((((p - per(from)) * dir) % total) + total) % total; // distance round, in `dir`
    const end = ahead(per(to));
    return corners.filter((c) => ahead(per(c)) < end).sort((c1, c2) => ahead(per(c1)) - ahead(per(c2)));
  };
  for (const dir of [1, -1]) {
    const poly = [a, ...best, b, ...walk(b, a, dir)];
    if (inside(seaPoint, poly)) return poly;
  }
  throw new Error('[hq-map] could not close the coastline round the map');
}

/* ---------- build ---------- */
const data = await osm();
const els = data.elements;
const tag = (e, k) => e.tags?.[k];
const wayPts = (e) => (e.geometry || []).filter(Boolean).map(pt);

const ROAD = {
  motorway: 'major',
  trunk: 'major',
  primary: 'major',
  secondary: 'mid',
  tertiary: 'mid',
  motorway_link: 'mid',
  trunk_link: 'mid',
  primary_link: 'mid',
  secondary_link: 'minor',
  tertiary_link: 'minor',
  residential: 'minor',
  unclassified: 'minor',
  living_street: 'minor',
  pedestrian: 'minor',
};
const layers = { water: [], green: [], pitch: [], sand: [], pier: [], minor: [], mid: [], major: [], rail: [], tram: [] };
const add = (layer, points, close) => {
  if (points.length < 2 || !onMap(points) || (close && area(points) < 12)) return;
  layers[layer].push(pathD(points, close));
};

for (const e of els) {
  const t = e.tags || {};
  if (e.type === 'way') {
    const p = wayPts(e);
    const closed = p.length > 3 && e.geometry[0].lat === e.geometry.at(-1).lat && e.geometry[0].lon === e.geometry.at(-1).lon;
    if (t.highway && ROAD[t.highway] && t.area !== 'yes') add(ROAD[t.highway], p, false);
    else if (t.railway === 'rail') add('rail', p, false);
    else if (t.railway === 'tram' || t.railway === 'light_rail') add('tram', p, false);
    else if (t.natural === 'water' && closed) add('water', p, true);
    else if (['beach', 'sand'].includes(t.natural) && closed) add('sand', p, true);
    else if (t.leisure === 'pitch' && closed) add('pitch', p, true);
    else if (t.man_made === 'pier') add('pier', p, closed);
    else if ((t.leisure || t.landuse || ['wood', 'scrub'].includes(t.natural)) && closed) add('green', p, true);
  } else if (e.type === 'relation') {
    const outers = e.members
      .filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry)
      .map((m) => m.geometry.filter(Boolean).map((g) => [g.lon, g.lat]));
    const layer = tag(e, 'natural') === 'water' ? 'water' : 'green';
    for (const ring of rings(outers)) add(layer, ring.map(project), true);
  }
}

const coast = els.filter((e) => tag(e, 'natural') === 'coastline').map((e) => e.geometry.filter(Boolean).map((g) => [g.lon, g.lat]));
const bay = sea(
  coast.map((w) => w.map(([lon, lat]) => ({ lon, lat }))),
  project([(west + east) / 2, south + 0.001]),
);

const C = {
  land: '#dcdbd6',
  sea: '#c3cbcc',
  water: '#c3cbcc',
  green: '#cfd2c4',
  dots: '#b3b8a6',
  pitch: '#c7cbbb',
  sand: '#e4ddcc',
  pier: '#e9e8e4',
  minor: '#eceae5',
  mid: '#f3f2ee',
  major: '#fbfaf7',
  rail: '#a7a59d',
  tram: '#b9b1ab',
};
const join = (list) => list.filter(Boolean).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<!-- Map data © OpenStreetMap contributors (ODbL), drawn by scripts/hq-map.mjs -->
<defs><pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${C.green}"/><circle cx="1.5" cy="1.5" r=".75" fill="${C.dots}"/><circle cx="4.5" cy="4.5" r=".75" fill="${C.dots}"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${C.land}"/>
<path fill="${C.sea}" d="${pathD(bay, true)}"/>
<path fill="${C.sand}" d="${join(layers.sand)}"/>
<path fill="url(#d)" d="${join(layers.green)}"/>
<path fill="${C.pitch}" d="${join(layers.pitch)}"/>
<path fill="${C.water}" d="${join(layers.water)}"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="${C.pier}" stroke-width="3" d="${join(layers.pier)}"/>
<path stroke="${C.minor}" stroke-width="2.2" d="${join(layers.minor)}"/>
<path stroke="${C.mid}" stroke-width="3.4" d="${join(layers.mid)}"/>
<path stroke="${C.major}" stroke-width="5" d="${join(layers.major)}"/>
<path stroke="${C.tram}" stroke-width="1" d="${join(layers.tram)}"/>
<path stroke="${C.rail}" stroke-width="1.1" d="${join(layers.rail)}"/>
</g>
</svg>
`;
const outDir = path.join(root, 'public/images/map');
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(path.join(outDir, 'hq-map.svg'), { force: true }); // the old vector version
const MAP_WIDTHS = [1500, 3000];
const sizes = [];
for (const w of MAP_WIDTHS) {
  const file = path.join(outDir, `hq-map-${w}.webp`);
  await sharp(Buffer.from(svg), { density: (72 * w) / W })
    .resize({ width: w })
    .webp({ quality: 82, effort: 6 })
    .toFile(file);
  sizes.push(`${w}px ${Math.round(fs.statSync(file).size / 1024)} kB`);
}

/* ---------- labels ---------- */
const pct = ([x, y]) => ({ x: +((x / W) * 100).toFixed(2), y: +((y / H) * 100).toFixed(2) });
const named = (list, kind) => list.map(({ name, coords }) => ({ kind, name, ...pct(project(coords)) }));

// each street's name on its longest straight stretch well inside the map, along the road
const hq = project(office.coords);
const roads = hqMap.roads.flatMap((name) => {
  let best = null;
  // OSM splits a street at every crossing: join its pieces into lines first
  const pieces = els.filter((x) => tag(x, 'name') === name && tag(x, 'highway')).map(wayPts);
  for (const line of rings(pieces)) {
    const p = simplify(line, 3);
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1];
      const [bx, by] = p[i];
      const len = Math.hypot(bx - ax, by - ay);
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      if (mx < W * 0.12 || mx > W * 0.88 || my < H * 0.08 || my > H * 0.92) continue;
      if (Math.hypot(mx - hq[0], my - hq[1]) < 70) continue; // clear of the head office's pin
      if (!best || len > best.len) best = { len, mx, my, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
    }
  }
  if (!best || best.len < 50) return [];
  let angle = best.angle;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return [{ kind: 'road', name, ...pct([best.mx, best.my]), angle: Math.round(angle * 10) / 10 }];
});

const labels = {
  width: W,
  height: H,
  widths: MAP_WIDTHS,
  hq: pct(project(office.coords)),
  items: [...named(hqMap.areas, 'area'), ...named(hqMap.waters, 'water'), ...roads, ...named(hqMap.places, 'place')],
};
fs.writeFileSync(path.join(root, 'src/data/hq-map.json'), JSON.stringify(labels, null, 2) + '\n');
console.log(`hq-map ${sizes.join(', ')}; ${roads.length}/${hqMap.roads.length} streets named`);
