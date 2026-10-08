/*
 * Timing of the About → Featured Projects scene (about.html), shared by about.js and the
 * clouds (sections/projects/intro-clouds.js). All in screen heights (vh) of scrolling,
 * counted from the moment the scene's stage reaches the top of the screen and holds.
 *
 *    0 ─  10  the head office map holds, full screen, the head office in the middle
 *   10 ─  50  the About panel slides in from the right; the map glides to keep the head
 *             office in the middle of what's left of it
 *   50 ─  90  the About screen holds
 *   90 ─ 160  a panel grows out of the About panel to fill the screen; its content fades
 *  150 ─ 185  the Featured Projects heading rises in
 *  160 ─ 200  behind the panel, the clouds thicken to full cover (and the camera moves to
 *             the skyline: `projectsIntro` and `skyline` share a view)
 *  280 ─ 380  the panel slides up off the screen onto the clouds
 *  395 ─ 475  the clouds slide apart onto the skyline
 *
 * The scene is `100 + HOLD` vh tall (about.css), so the stage holds for HOLD vh.
 */
export const SCENE = {
  slide: [10, 50],
  expand: [90, 160],
  fade: [90, 120],
  heading: [150, 185],
  cover: [160, 200],
  hold: 280,
  part: [395, 475],
};

/** Page scroll position (px) for a scene time (vh), from the scene's laid-out height. */
export function sceneScroll(scene, vh) {
  const unit = scene.offsetHeight / (100 + SCENE.hold);
  return scene.getBoundingClientRect().top + window.scrollY + vh * unit;
}
