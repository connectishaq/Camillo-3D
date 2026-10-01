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

/** Hero map panel (measured from camillo.com.au) and its expand-on-scroll. */
export const HERO_PANEL = {
  radius: 0.247, // top-left corner, as a share of the panel width (226.5px of 917px at 1440px)
  radiusMobile: 40, // px, both top corners on mobile
  scrollLength: 1, // pinned scroll distance, in viewport heights
  zoomOut: 1.18, // camera pulled back a little while the panel is small
};

// Colours live in styles/tokens.css; JS reads them through gfx/palette.js.

/** Default floor-to-floor height (m) when a building spec doesn't set one. */
export const FLOOR_H = 3.3;
