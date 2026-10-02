/*
 * Optimised web images from the original photos in project-assets/<slug>/:
 *   public/images/projects/<name>-<width>.webp   640, 1280 and 1920 px wide, or the photo's own
 *   width when it's smaller (never upscaled); real widths go to src/data/images.json.
 * One per project (`image` in src/data/projects/<slug>.js) plus the intro photos
 * (`introImages` in src/data/company.js). Run `npm run images` after adding a photo.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { loadSiteData } from '../vite-plugins/site-data.js';
import { imageName, IMAGE_WIDTHS } from '../vite-plugins/images.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/images/projects');
fs.mkdirSync(out, { recursive: true });
const { projects, introImages } = await loadSiteData(path.join(root, 'src'));
const jobs = [...projects.map((p) => ({ project: p.slug, file: p.image.file })), ...introImages];
const manifest = {};

for (const { project, file } of jobs) {
  const src = path.join(root, 'project-assets', project, file);
  const { width } = await sharp(src).metadata();
  const name = imageName(project, file);
  const widths = [...new Set(IMAGE_WIDTHS.map((w) => Math.min(w, width)))];
  for (const w of widths) {
    const dest = path.join(out, `${name}-${w}.webp`);
    await sharp(src).resize({ width: w }).webp({ quality: 76, effort: 5 }).toFile(dest);
    console.log(path.relative(root, dest), `${Math.round(fs.statSync(dest).size / 1024)} kB`);
  }
  manifest[name] = widths;
}
fs.writeFileSync(path.join(root, 'src/data/images.json'), JSON.stringify(manifest, null, 2) + '\n');
