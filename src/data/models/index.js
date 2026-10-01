/**
 * Project building specs, one JSON per project in this folder (`<slug>.json`), written
 * from the reference images in `project-assets/<slug>/`. See README → "Adding a project".
 *
 * `normalizeSpec` fills defaults and returns the model object the explorer, the city
 * and the map read: `{ width, depth, floorHeight, floors[], bands{}, roof, features[] … }`.
 */
const specs = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const SPECS = Object.fromEntries(Object.entries(specs).map(([path, json]) => [path.replace(/^\.\/|\.json$/g, ''), json]));

const DEFAULT_WINDOWS = { bay: 3.2, wwr: 0.55, mullions: 1, frameDepth: 0.18, sill: 0.8, head: 0.4 };
const DEFAULT_COLORS = { wall: '#d9d4ca', slab: '#cfcac1', frame: '#2a2b2d', glass: '#5d707c', accent: '#8e8b85', balustrade: '#a9c1cc' };
const SYSTEM_STYLE = { brick: 'brick', 'board-concrete': 'house', timber: 'house', travertine: 'stone', stone: 'stone', precast: 'stone', 'glass-curtain': 'glass', render: 'glass', metal: 'glass', concrete: 'glass' };

const val = (v, d) => (v && typeof v === 'object' && 'value' in v ? v.value : v ?? d);

export function normalizeSpec(spec) {
  const fp = spec.footprint || {};
  const bands = {};
  Object.entries(spec.bands || {}).forEach(([name, b]) => {
    bands[name] = {
      ...b, // keep band options such as `recess`
      name,
      system: b.system || 'render',
      colors: { ...DEFAULT_COLORS, ...(b.colors || {}) },
      windows: { ...DEFAULT_WINDOWS, ...(b.windows || {}) },
      balcony: b.balcony && b.balcony.type !== 'none' ? { depth: 1.6, balustrade: 'glass', sides: ['front'], bays: 'all', ...b.balcony } : null,
      frames: b.frames || null,
      fins: b.fins || null,
      sides: b.sides || null, // optional per-side window overrides
    };
  });
  if (!Object.keys(bands).length) bands.main = normalizeSpec({ bands: { main: {} } }).bands.main;
  const first = Object.keys(bands)[0];
  const floors = (spec.levels || []).map((l, i) => ({
    label: l.label || `Level ${i}`,
    program: l.program || 'apartments',
    units: l.units ?? 1,
    setback: l.setback || 0,
    band: bands[l.band] ? l.band : first,
    height: l.height || null,
  }));
  const mainBand = bands[floors.find((f) => f.program !== 'lobby' && f.program !== 'rumpus')?.band || first];
  const features = spec.features || [];
  return {
    slug: spec.slug,
    indicative: spec.indicative !== false,
    sources: spec.sources || [],
    width: val(fp.width, 24),
    depth: val(fp.depth, 20),
    floorHeight: val(spec.floorHeight, 3.2),
    floors,
    bands,
    roof: { type: 'flat-parapet', parapet: 0.9, plant: true, garden: false, ...(spec.roof || {}) },
    features,
    pool: features.some((f) => f.type === 'pool'),
    style: SYSTEM_STYLE[mainBand.system] || 'glass',
    assumptions: spec.assumptions || [],
    improveWith: spec.improveWith || [],
  };
}

export function modelFor(slug, fallback) {
  const spec = SPECS[slug];
  return spec ? normalizeSpec(spec) : fallback;
}

/** Total height of a model (top of roof slab, excluding plant). */
export function modelHeight(model) {
  return model.floors.reduce((h, f) => h + (f.height || model.floorHeight || 3.3), 0) + 0.3;
}

/** Published facts that a spec must reproduce (checked in dev). */
export function checkFacts(model, { levels, units } = {}) {
  const issues = [];
  if (levels !== undefined && model.floors.length !== levels) issues.push(`levels ${model.floors.length} ≠ ${levels}`);
  const total = model.floors.reduce((n, f) => n + (f.program === 'lobby' && !f.units ? 0 : f.units || 0), 0);
  if (units !== undefined && total !== units) issues.push(`residences ${total} ≠ ${units}`);
  return issues;
}
