/**
 * Shared constants for the JavaScript side. The CSS equivalents live in
 * styles/tokens.css (colours) and the `@media (max-width: 860px)` rules; keep them in step.
 */

/** Layout switches to the single-column mobile story at this width (px). */
export const BREAKPOINT = 860;
/** Small screens and touch devices get the lighter render settings. */
export const MOBILE_QUERY = `(max-width: ${BREAKPOINT}px), (pointer: coarse)`;
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Max width of a story card (px), as in `--card-w`. Map cameras shift the subject clear of it. */
export const CARD_WIDTH = 460;

export const COLORS = {
  brass: '#c9a56b', // --brass
  brassLight: '#e8c58a', // active project extrusion (map mode)
  brassHot: '#f3d49a', // active site marker
  ink: '#0d0e10', // --ink-900
};

/** Default floor-to-floor height (m) when a building spec doesn't set one. */
export const FLOOR_H = 3.3;
