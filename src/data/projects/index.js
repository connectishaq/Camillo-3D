import { modelFor, checkFacts } from '../models/index.js';

/**
 * All featured projects, in story order (`order`). Every `<slug>.js` file in this folder
 * is picked up automatically, so adding a project means adding one file.
 * Each project gets its normalised 3D `model` from data/models/<slug>.json.
 */
const files = import.meta.glob(['./*.js', '!./index.js'], { eager: true, import: 'default' });

export const projects = Object.values(files)
  .sort((a, b) => a.order - b.order)
  .map((p) => ({ ...p, model: modelFor(p.slug, p.model) }));

if (import.meta.env.DEV) {
  projects.forEach((p) => {
    const issues = p.publishedFacts && p.model.bands ? checkFacts(p.model, p.publishedFacts) : [];
    if (issues.length) console.warn(`[models] ${p.slug} does not match published facts:`, issues.join(', '));
  });
}
