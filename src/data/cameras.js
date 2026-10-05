/**
 * Map camera presets for the non-project chapters, in web-map terms: `center` is
 * [lng, lat], plus zoom, pitch and bearing. Project chapters use each project's `camera`.
 */
export const cameras = {
  hero: { center: [144.9631, -37.8136], zoom: 14.6, pitch: 62, bearing: -20 },
  office: { center: [144.9246, -37.8309], zoom: 16.8, pitch: 60, bearing: 35 },
  // low over the CBD skyline, so the towers rise out of the Featured Projects cloud sea
  projectsIntro: { center: [144.9631, -37.8136], zoom: 15.2, pitch: 72, bearing: -25 },
  overview: { center: [144.99, -37.845], zoom: 10.9, pitch: 35, bearing: 0 },
  contact: { center: [144.9246, -37.8309], zoom: 15.4, pitch: 55, bearing: -30 },
};

/** Head office pin. [lng, lat] — approximate, see README "Before launch". */
export const office = {
  name: 'Camillo HQ',
  coords: [144.9246, -37.8309],
};
