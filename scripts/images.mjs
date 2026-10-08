/*
 * Optimised web images from the original photos in project-assets/<slug>/:
 *   public/images/projects/<name>-<width>.webp   640 to 3840 px wide (IMAGE_WIDTHS), up to the
 *   photo's own width (never upscaled); the widths and the photo's size go to
 *   src/data/images.json. The big widths are for full-screen heroes on large, sharp screens.
 * Each project's `image` and `about.images` (src/data/projects/<slug>.js) plus the Gallery
 * (src/data/gallery.js). Phone photos are turned upright from their EXIF orientation.
 * Run `npm run images` after adding a photo.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { loadSiteData } from '../vite-plugins/site-data.js';
import { imageName, IMAGE_WIDTHS } from '../vite-plugins/images.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/images/projects');
fs.mkdirSync(out, { recursive: true });
const { projects, gallery } = await loadSiteData(path.join(root, 'src'));
const all = [
  ...projects.flatMap((p) =>
    [p.image, p.hero?.image, ...(p.about?.images ?? [])].filter(Boolean).map(({ file }) => ({ project: p.slug, file })),
  ),
  ...gallery.map(({ project, file }) => ({ project, file })),
];
const jobs = [...new Map(all.map((j) => [imageName(j.project, j.file), j])).values()];
const manifest = {};

for (const { project, file } of jobs) {
  const src = path.join(root, 'project-assets', project, file);
  const meta = await sharp(src).metadata();
  // EXIF orientations 5-8 are quarter turns: the upright photo has its sides swapped
  const [width, height] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const name = imageName(project, file);
  const widths = [...new Set(IMAGE_WIDTHS.map((w) => Math.min(w, width)))];
  for (const w of widths) {
    const dest = path.join(out, `${name}-${w}.webp`);
    await sharp(src).rotate().resize({ width: w }).webp({ quality: 80, effort: 5, smartSubsample: true }).toFile(dest);
    console.log(path.relative(root, dest), `${Math.round(fs.statSync(dest).size / 1024)} kB`);
  }
  manifest[name] = { widths, width, height };
}
// widths on one line, as Prettier formats it
const json = JSON.stringify(manifest, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, list) => `[${list.split(/,\s*/).join(', ')}]`);
fs.writeFileSync(path.join(root, 'src/data/images.json'), json + '\n');
