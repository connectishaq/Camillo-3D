/*
 * Timing of the About → Featured Projects scene (about.html), shared by about.js and the
 * clouds (sections/projects/intro-clouds.js). All in screen heights (vh) of scrolling,
 * counted from the moment the scene's stage reaches the top of the screen and holds.
 *
 *    0 ─  40  the About card holds
 *   40 ─ 110  a panel grows out of the card to fill the screen; the card's content fades
 *  100 ─ 135  the Featured Projects heading rises in
 *  110 ─ 150  behind the panel, the clouds thicken to full cover (and the camera moves to
 *             the skyline: `projectsIntro` and `skyline` share a view)
 *  230 ─ 330  the panel slides up off the screen onto the clouds
 *  345 ─ 425  the clouds slide apart onto the skyline
 *
 * The scene is `100 + HOLD` vh tall (about.css), so the stage holds for HOLD vh.
 */
export const SCENE = {
  card: [0, 40],
  expand: [40, 110],
  fade: [40, 70],
  heading: [100, 135],
  cover: [110, 150],
  hold: 230,
  part: [345, 425],
};

/** Page scroll position (px) for a scene time (vh), from the scene's laid-out height. */
export function sceneScroll(scene, vh) {
  const unit = scene.offsetHeight / (100 + SCENE.hold);
  return scene.getBoundingClientRect().top + window.scrollY + vh * unit;
}
