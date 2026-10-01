/* Project page entry: the static content is in the HTML; this mounts the inline 3D explorer. */
import { initPage } from '../page.js';
import './project.css';
import { projects } from '../../data/projects/index.js';
import { Explorer } from '../../features/explorer/Explorer.js';
import { hasGLB, loadGLB } from '../../features/explorer/glb.js';

initPage();

const project = projects.find((p) => p.slug === document.body.dataset.project);
const root = document.querySelector('[data-explorer]');

if (project && root) {
  const explorer = new Explorer(root, { modal: false });
  (hasGLB(project.slug) ? loadGLB(project.slug, project.model) : Promise.resolve()).then(() => {
    explorer.open(project);
    // only render while the model is on screen
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? explorer.resume() : explorer.pause())).observe(root);
  });
}
