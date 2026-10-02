import fs from 'node:fs';
import path from 'node:path';
import { renderTemplate } from './template.js';
import { loadSiteData, pageScope, projectSlugs } from './site-data.js';

/*
 * Builds every HTML page from the section partials at build time (real static HTML),
 * generates one page per project from src/pages/project/project.html, and writes
 * sitemap.xml and robots.txt. In dev the same pages are rendered on request.
 */
const PROJECT_TEMPLATE = 'src/pages/project/project.html';
const PROJECT_URL = /^\/projects\/([a-z0-9-]+?)(?:\.html)?\/?$/;

/** Rollup inputs for the generated project pages: { 'projects/<slug>': '<root>/projects/<slug>.html' } */
export function projectPageInputs(root) {
  return Object.fromEntries(
    projectSlugs(path.join(root, 'src')).map((slug) => [`projects/${slug}`, path.join(root, `projects/${slug}.html`)]),
  );
}

export function htmlPages({ site }) {
  const projectPages = site.multiPage;
  let root;
  let srcDir;
  const partials = new Set();

  const pageFor = (file) => {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel === 'index.html') return { kind: 'home' };
    if (rel === '404.html') return { kind: 'not-found' };
    const m = rel.match(/^projects\/([a-z0-9-]+)\.html$/);
    return m ? { kind: 'project', slug: m[1] } : null;
  };
  const isProjectPage = (id) => projectPages && pageFor(id)?.kind === 'project';

  const render = async (html, file) => {
    const page = pageFor(file);
    if (!page) return html;
    const scope = pageScope(await loadSiteData(srcDir), page, site, srcDir);
    return renderTemplate(html, scope, { file, srcDir, onInclude: (f) => partials.add(f) });
  };

  return {
    name: 'camillo-html-pages',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      srcDir = path.join(root, 'src');
    },

    // Project pages don't exist on disk: they're the project template, rendered per slug.
    resolveId(id) {
      return isProjectPage(id) ? id : null;
    },
    load(id) {
      return isProjectPage(id) ? fs.readFileSync(path.join(root, PROJECT_TEMPLATE), 'utf8') : null;
    },

    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => render(html, ctx.filename),
    },

    configureServer(server) {
      // dev: serve /projects/<slug> and /projects/<slug>.html from the template
      server.middlewares.use(async (req, res, next) => {
        const slug = projectPages && req.url.split('?')[0].match(PROJECT_URL)?.[1];
        if (!slug || !projectSlugs(srcDir).includes(slug)) return next();
        try {
          const template = fs.readFileSync(path.join(root, PROJECT_TEMPLATE), 'utf8');
          const html = await server.transformIndexHtml(`/projects/${slug}.html`, template, req.originalUrl);
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
      server.middlewares.use((req, res, next) => {
        const name = req.url.split('?')[0];
        if (name !== '/sitemap.xml' && name !== '/robots.txt') return next();
        loadSiteData(srcDir).then((data) => {
          res.setHeader('Content-Type', name.endsWith('.xml') ? 'application/xml' : 'text/plain');
          res.end(name.endsWith('.xml') ? sitemap(data, site) : robots(site));
        }, next);
      });
      // partials and page templates aren't in the module graph: reload the page when they change
      server.watcher.on('change', (file) => {
        if (file.endsWith('.html') && (partials.has(file) || file.startsWith(srcDir))) server.ws.send({ type: 'full-reload' });
      });
    },

    async generateBundle() {
      if (!site.multiPage) return;
      const data = await loadSiteData(srcDir);
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(data, site) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(site) });
    },
  };
}

function sitemap({ projects }, site) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', ...projects.map((p) => `/projects/${p.slug}`)];
  const entries = urls.map((u) => `  <url>\n    <loc>${site.url}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

function robots(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`;
}
