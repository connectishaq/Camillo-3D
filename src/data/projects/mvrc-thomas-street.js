/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 6,
  slug: 'mvrc-thomas-street',
  name: 'MVRC – Thomas Street',
  suburb: 'Moonee Ponds',
  type: 'Residential',
  status: 'Under construction',
  coords: [144.9335, -37.7632],
  facts: [
    ['Precinct', 'Moonee Valley Racecourse'],
    ['Status', 'Under construction'],
    ['Stage', 'Part of the MVRC renewal'],
  ],
  summary:
    'Part of the Moonee Valley Racecourse precinct renewal — contemporary apartments with generous balconies, a considered lobby and bright, practical kitchens.',
  materials: 'Precast façade, glazing and metal balustrades.',
  // hero / card photo from project-assets/mvrc-thomas-street/ (optimised by `npm run images`)
  image: { file: '191023_C_V01_HERO-Large.jpeg', position: '50% 55%' },
  camera: { zoom: 17, pitch: 62, bearing: -60 },
};
