import { toast } from '../components/toast/toast.js';

/**
 * Lazy launcher for the Building Explorer dialog. The explorer code (and Three.js) is
 * downloaded on the first "Explore in 3D" click, or earlier on hover/focus via `preload`.
 * Returns `{ open(project), preload() }`.
 */
export function createExplorerLauncher(root, { onOpen, onClose }) {
  let loading;
  const load = () =>
    (loading ??= Promise.all([import('../features/explorer/Explorer.js'), import('../features/explorer/glb.js')]).then(
      ([{ Explorer }, glb]) => ({ explorer: new Explorer(root, { onOpen, onClose }), glb }),
    ));

  const preload = () => {
    load().catch(() => (loading = null)); // a failed preload is retried on click
  };

  const open = async (project) => {
    if (!project) return;
    try {
      const { explorer, glb } = await load();
      // Path A: wait for public/models/<slug>.glb if there is one (the city may already have it)
      if (glb.hasGLB(project.slug)) await glb.loadGLB(project.slug, project.model);
      explorer.open(project);
    } catch (err) {
      loading = null;
      console.warn('[explorer] could not load:', err);
      toast('The 3D explorer couldn’t load. Please check your connection and try again.');
    }
  };

  if (import.meta.env.DEV) window.__explorer = { load }; // debugging handle (dev only)
  return { open, preload };
}
