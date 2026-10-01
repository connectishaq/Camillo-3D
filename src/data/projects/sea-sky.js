/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 4,
  slug: 'sea-sky',
  name: 'Sea & Sky',
  suburb: 'Sandringham',
  address: '212 Bay Road, Sandringham',
  type: 'Residential',
  status: 'Complete · 2023',
  coords: [145.0071, -37.9509],
  facts: [
    ['Levels', '6'],
    ['Residences', '63 apartments + penthouse'],
    ['Architect', 'CBG · Landscape by John Patrick'],
  ],
  summary:
    'A boutique collection capturing the place where the sea meets the sky. A layered façade plays with light and shadow, framing oversized balconies and bay views.',
  materials: 'Italian kitchens, European appliances, stone surfaces.',
  camera: { zoom: 17.1, pitch: 62, bearing: 60 },
  // published numbers the 3D model must reproduce (checked in dev)
  publishedFacts: { levels: 6, units: 64 },
};
