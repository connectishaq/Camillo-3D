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
  // hero / card photo from project-assets/sea-sky/ (optimised by `npm run images`)
  image: { file: 'EXT01_Exterior.jpg', position: '50% 42%' },
  camera: { zoom: 17.1, pitch: 62, bearing: 60 },
  // the project page (as The London): figures over the hero photo, then "About the project"
  // (from Camillo's project page)
  hero: {
    stats: [
      { value: '6 levels', label: 'Residential · complete 2023', text: 'A boutique collection in Sandringham Village, at 212 Bay Road.' },
      { value: '63 + 1', label: 'Apartments & a penthouse', text: 'Two- and three-bedroom homes with generous floorplans.' },
      { value: 'Snaidero', label: 'Italian kitchens', text: 'With European Miele appliances, stone surfaces and bespoke joinery.' },
      { value: 'Bay views', label: 'Port Phillip Bay', text: 'Panoramic views of the bay and the glimmer of the city lights.' },
      { value: 'Artist-led', label: 'Antoinette Ferwerda', text: 'A private art commission shaped the design.' },
    ],
  },
  about: {
    title: 'Sea & Sky',
    text: [
      'Nestled in Sandringham Village, Sea & Sky is a boutique collection of apartments across six levels, an artist-inspired, architectural expression of Sandringham’s coastal character. Bright, spacious interiors extend to large terrace balconies, gardens and private retreats.',
      'Shaped by a private commission from Australian artist Antoinette Ferwerda, its complex, layered façade lets sunlight and shadow play across its recesses and extrusions through the day. Camillo delivered 63 house-sized dwellings and a luxury penthouse, with Snaidero kitchens and Miele appliances.',
    ],
    images: [
      { file: 'EXT02_Garden.jpg', alt: 'A winding path through the planted courtyard garden at Sea & Sky', position: '50% 50%' },
      { file: 'SeaSky-lobby.jpg', alt: 'The Sea & Sky lobby, with an artwork at the end of the hall', position: '50% 50%' },
    ],
  },
  // published numbers the 3D model must reproduce (checked in dev)
  publishedFacts: { levels: 6, units: 64 },
};
