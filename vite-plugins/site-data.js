import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { imageName } from './images.js';

/*
 * Reads the site content (src/data) in Node, for writing the static HTML at build time.
 * The data files are plain ES modules, so the browser and the build share one source.
 */

/** Project slugs, from the file names in src/data/projects (`<slug>.js`). */
export function projectSlugs(srcDir) {
  return fs
    .readdirSync(path.join(srcDir, 'data/projects'))
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .map((f) => f.slice(0, -3));
}

// Node caches modules by URL: re-import a file only when it has changed (dev edits).
const importFresh = (file) => import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);

export async function loadSiteData(srcDir) {
  const { company, moreProjects } = await importFresh(path.join(srcDir, 'data/company.js'));
  const { gallery } = await importFresh(path.join(srcDir, 'data/gallery.js'));
  const { hqMap } = await importFresh(path.join(srcDir, 'data/hq-map.js'));
  const { office } = await importFresh(path.join(srcDir, 'data/cameras.js'));
  const projects = await Promise.all(
    projectSlugs(srcDir).map(async (slug) => {
      const project = (await importFresh(path.join(srcDir, `data/projects/${slug}.js`))).default;
      if (project.slug !== slug) throw new Error(`[site-data] data/projects/${slug}.js has slug "${project.slug}"; they must match`);
      return project;
    }),
  );
  projects.sort((a, b) => a.order - b.order);
  return { company, moreProjects, projects, gallery, hqMap, office };
}

/** Straight-line distance in km between two [lng, lat] points (fine at city scale). */
const km = ([lng1, lat1], [lng2, lat2]) =>
  Math.hypot((lng2 - lng1) * 111.32 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180), (lat2 - lat1) * 110.54);

/**
 * The About section's map (sections/about/hq-map.html): label positions from
 * src/data/hq-map.json (written by `npm run map`), the distances from the head office.
 */
function aboutMap(srcDir, data, prefix) {
  const file = path.join(srcDir, 'data/hq-map.json');
  if (!fs.existsSync(file)) throw new Error('[site-data] no src/data/hq-map.json: run "npm run map"');
  const labels = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { west, east, north, south } = data.hqMap.bbox;
  return {
    src: `${prefix}images/map/hq-map-${labels.widths[0]}.webp`,
    srcset: labels.widths.map((w) => `${prefix}images/map/hq-map-${w}.webp ${w}w`).join(', '),
    width: labels.width,
    height: labels.height,
    aspect: (labels.width / labels.height).toFixed(4),
    hq: labels.hq,
    items: labels.items.map((l) => ({ ...l, angle: l.angle ?? 0 })),
    distances: data.hqMap.distances.map((d) => ({ ...d, km: km(data.office.coords, d.coords).toFixed(1) })),
    // our projects inside the map, as pins linking to their pages
    projects: data.projects
      .filter(({ coords: [lng, lat] }) => lng > west && lng < east && lat > south && lat < north)
      .map((p) => ({
        name: p.name,
        url: `/projects/${p.slug}`,
        x: (((p.coords[0] - west) / (east - west)) * 100).toFixed(2),
        y: (((north - p.coords[1]) / (north - south)) * 100).toFixed(2),
      })),
  };
}

/**
 * An optimised photo for the templates: { src, thumb, srcset, width, height, position, alt },
 * from what scripts/images.mjs recorded in src/data/images.json.
 */
function photo(srcDir, { project, file, position = '50% 50%', alt }, prefix) {
  const name = imageName(project, file);
  const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'data/images.json'), 'utf8'));
  const entry = manifest[name];
  if (!entry?.widths) throw new Error(`[site-data] no optimised images for ${project}/${file}: run "npm run images"`);
  const { widths, width, height } = entry;
  const url = (w) => `${prefix}images/projects/${name}-${w}.webp`;
  return {
    src: url(widths.find((w) => w >= 1200) ?? widths.at(-1)),
    thumb: url(widths[0]),
    srcset: widths.map((w) => `${url(w)} ${w}w`).join(', '),
    width,
    height,
    shape: width / height < 1.1 ? 'portrait' : 'landscape',
    position,
    alt,
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** Presentation fields the templates need, worked out once here rather than in the HTML. */
function decorateProject(p, i, all, srcDir, prefix) {
  return {
    ...p,
    photo: photo(srcDir, { project: p.slug, ...p.image, alt: `${p.name}, ${p.suburb}` }, prefix),
    // the project page's hero: its own photo when the card's isn't big or wide enough
    heroPhoto: photo(srcDir, { project: p.slug, ...(p.hero?.image ?? p.image), alt: `${p.name}, ${p.suburb}` }, prefix),
    ...(p.about && { about: { ...p.about, photos: p.about.images.map((img) => photo(srcDir, { project: p.slug, ...img }, prefix)) } }),
    keyFacts: p.facts.slice(0, 2).map(([label, value]) => ({ label, value })),
    side: i % 2 === 0 ? 'left' : 'right', // chapters alternate sides for rhythm
    number: pad(i + 1),
    total: pad(all.length),
    eyebrow: p.address ? p.suburb : `${p.suburb}, VIC`,
    factList: [...(p.address ? [['Address', p.address]] : []), ...p.facts].map(([label, value]) => ({ label, value })),
    url: `/projects/${p.slug}`,
  };
}

/** Template scope for one page. `page` is { kind: 'home' | 'project' | 'not-found', slug? }. */
export function pageScope(data, page, site, srcDir) {
  const { company, moreProjects } = data;
  // photo URLs: relative on the home page (also works opened from disk), from the root elsewhere
  const prefix = page.kind === 'home' ? '' : '/';
  const projects = data.projects.map((p, i, all) => decorateProject(p, i, all, srcDir, prefix));
  const project = page.kind === 'project' ? projects.find((p) => p.slug === page.slug) : null;
  if (page.kind === 'project' && !project) throw new Error(`[site-data] unknown project "${page.slug}"`);

  const isHome = page.kind === 'home';
  const pagePath = isHome ? '/' : project ? project.url : '/404';
  const title = project
    ? `${project.name}, ${project.suburb} — Camillo Builders`
    : page.kind === 'not-found'
      ? 'Page not found — Camillo Builders'
      : 'Camillo — Residential & Commercial Builders, Melbourne';
  const description = project
    ? project.summary
    : "Camillo is a Melbourne construction company backed by 70 years' experience, building bespoke residential, commercial and fit-out projects.";

  // the Gallery: each photo with its project's name, page and an index for the lightbox
  const gallery = data.gallery.map((g, i) => {
    const p = projects.find((x) => x.slug === g.project);
    if (!p) throw new Error(`[site-data] gallery photo ${g.file}: unknown project "${g.project}"`);
    return { ...photo(srcDir, g, prefix), index: i, number: pad(i + 1), name: p.name, suburb: p.suburb, url: p.url };
  });

  return {
    site,
    company,
    moreProjects,
    projects,
    gallery,
    galleryTotal: pad(gallery.length),
    hqMap: isHome ? aboutMap(srcDir, data, prefix) : null,
    footerPhoto:
      gallery[
        Math.max(
          0,
          data.gallery.findIndex((g) => g.footer),
        )
      ],
    project,
    intro: { total: String(projects.length + 1).padStart(2, '0') },
    year: new Date().getFullYear(),
    services: company.services.map((s, i) => ({ ...s, number: pad(i + 1) })),
    stats: company.stats.map((s) => ({ prefix: '', suffix: '', ...s })),
    explorer: { inline: !!project },
    page: {
      isHome,
      noindex: page.kind === 'not-found',
      home: isHome ? '' : '/', // header links: '#about' on the home page, '/#about' elsewhere
      title,
      description,
      url: site.url + pagePath,
      image: `${site.url}/images/og-image.jpg`,
      imageAlt: 'Camillo, Residential & Commercial Builders, beside a 3D map of Melbourne’s CBD',
      type: project ? 'article' : 'website',
    },
  };
}
