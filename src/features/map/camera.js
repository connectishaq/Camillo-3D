import { BREAKPOINT, CARD_WIDTH } from '../../config.js';

/*
 * Camera helpers shared by the map stages (CityStory, MapStory, PhotorealStory).
 * Chapters are keyed 'hero' | 'office' | 'projectsIntro' | 'overview' | 'contact' | 'project:<slug>'.
 */

/** Map-style camera `{ center, zoom, pitch, bearing }` for a chapter, or null. */
export function chapterCamera(chapter, { cameras, projects }) {
  if (chapter.startsWith('project:')) {
    const p = projects.find((x) => x.slug === chapter.split(':')[1]);
    return p ? { center: p.coords, ...p.camera } : null;
  }
  return cameras[chapter] || null;
}

/** Camera distance (m) that shows the same ground scale as a web-map zoom level. */
export function zoomToDistance(center, zoom, viewportHeight, fov) {
  const metresPerPixel = (78271.517 * Math.cos((center[1] * Math.PI) / 180)) / Math.pow(2, zoom);
  return (metresPerPixel * viewportHeight) / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
}

/** The side a chapter's card sits on ('left' | 'right'), from its `data-side`. */
export const chapterSide = (chapter) => document.querySelector(`[data-chapter="${chapter}"]`)?.dataset.side;

/** Horizontal space (px) a story card covers, plus a margin. */
export const cardClearance = (viewportWidth) => Math.min(CARD_WIDTH, viewportWidth * 0.4) + 60;

export const isNarrow = (viewportWidth) => viewportWidth <= BREAKPOINT;

/** Screen shift (px) that centres the subject in the space beside the card. 0 on mobile. */
export function sideOffset(chapter, viewportWidth) {
  if (isNarrow(viewportWidth)) return 0;
  const side = chapterSide(chapter);
  const shift = cardClearance(viewportWidth) / 2;
  return side === 'left' ? -shift : side === 'right' ? shift : 0;
}
