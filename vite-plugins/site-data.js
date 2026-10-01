import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  const projects = await Promise.all(
    projectSlugs(srcDir).map(async (slug) => {
      const project = (await importFresh(path.join(srcDir, `data/projects/${slug}.js`))).default;
      if (project.slug !== slug) throw new Error(`[site-data] data/projects/${slug}.js has slug "${project.slug}"; they must match`);
      return project;
    }),
  );
  projects.sort((a, b) => a.order - b.order);
  return { company, moreProjects, projects };
}

const pad = (n) => String(n).padStart(2, '0');

/** Presentation fields the templates need, worked out once here rather than in the HTML. */
function decorateProject(p, i, all) {
  return {
    ...p,
    side: i % 2 === 0 ? 'left' : 'right', // chapters alternate sides for rhythm
    number: pad(i + 1),
    total: pad(all.length),
    eyebrow: p.address ? p.suburb : `${p.suburb}, VIC`,
    factList: [...(p.address ? [['Address', p.address]] : []), ...p.facts].map(([label, value]) => ({ label, value })),
    url: `/projects/${p.slug}`,
  };
}

/** Template scope for one page. `page` is { kind: 'home' | 'project' | 'not-found', slug? }. */
export function pageScope(data, page, site) {
  const { company, moreProjects } = data;
  const projects = data.projects.map(decorateProject);
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

  return {
    site,
    company,
    moreProjects,
    projects,
    project,
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
