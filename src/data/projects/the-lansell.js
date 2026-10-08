/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 3,
  slug: 'the-lansell',
  name: 'The Lansell',
  suburb: 'Toorak',
  type: 'Residential',
  status: 'Under construction',
  coords: [145.0107, -37.8434],
  facts: [
    ['Status', 'Under construction'],
    ['Amenity', 'Private & common lobbies'],
    ['Landscape', 'Interior garden spaces'],
  ],
  summary:
    'Quiet luxury on one of Toorak’s most prestigious streets — a boutique residential building arranged around private lobbies and landscaped interior gardens.',
  materials: 'Refined masonry, glazing and landscaped courts.',
  // hero / card photo from project-assets/the-lansell/ (optimised by `npm run images`)
  image: { file: 'S010-1-Render-Hero-Street.jpeg', position: '45% 55%' },
  camera: { zoom: 17.4, pitch: 60, bearing: -15 },
  // the project page (as The London): figures over the hero photo, then "About the project"
  hero: {
    image: { file: 'Lansell-garden.jpg', position: '50% 55%' },
    stats: [
      { value: 'Toorak', label: 'Under construction', text: 'On one of Toorak’s most prestigious streets.' },
      { value: 'Private', label: 'Lobbies', text: 'Private and common lobbies.' },
      { value: 'Gardens', label: 'Interior landscape', text: 'Landscaped interior gardens and courts.' },
      { value: 'Boutique', label: 'Residential building', text: 'Quiet luxury in refined masonry and glazing.' },
    ],
  },
  about: {
    title: 'The Lansell',
    text: [
      'Quiet luxury on one of Toorak’s most prestigious streets: a boutique residential building arranged around private lobbies and landscaped interior gardens.',
      'Refined masonry and glazing frame its landscaped courts, with private and common lobbies.',
    ],
    images: [
      { file: 'Lansell-private-lobby.jpg', alt: 'A private lobby at The Lansell, with an arched glass door', position: '50% 50%' },
      { file: 'Lansell-common-lobby.jpeg', alt: 'The common lobby: two armchairs before a timber-panelled wall', position: '50% 50%' },
    ],
  },
};
