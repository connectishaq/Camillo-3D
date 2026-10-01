/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 1,
  slug: 'the-london',
  name: 'The London',
  suburb: 'Port Melbourne',
  type: 'Residential',
  status: 'Complete',
  coords: [144.9369, -37.8434],
  facts: [
    ['Levels', '7'],
    ['Residences', '13 luxury apartments'],
    ['Setting', 'Opposite the beach & Station Pier'],
  ],
  summary:
    'Built on the historic site of the original London Hotel (est. 1861), The London reimagines beachside living with uninterrupted Port Phillip Bay views from every residence.',
  materials: 'Brickwork, raw concrete, charcoal metalwork and timber soffits.',
  camera: { zoom: 17.4, pitch: 64, bearing: -40 },
  // published numbers the 3D model must reproduce (checked in dev)
  publishedFacts: { levels: 7, units: 13 },
};
