/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 5,
  slug: 'the-righi',
  name: 'The Righi',
  suburb: 'Eaglemont',
  type: 'Luxury residence',
  status: 'Under construction',
  coords: [145.0655, -37.7636],
  facts: [
    ['Pool', 'Glass-free infinity edge'],
    ['Wellness', 'Infrared sauna · gym'],
    ['Materials', 'Concrete & timber'],
  ],
  summary:
    'Camillo’s landmark luxury home — a multi-generational family residence with a basement rumpus lit by the pool above, a gymnastics room, wellness suite and formal lounge.',
  materials: 'Board-formed concrete and warm timber throughout.',
  // hero / card photo from project-assets/the-righi/ (optimised by `npm run images`)
  image: { file: '05-Bedroom-Windows.jpg', position: '50% 50%' },
  camera: { zoom: 17.8, pitch: 60, bearing: 20 },
  // the project page (as The London): figures over the hero photo, then "About the project"
  hero: {
    image: { file: 'Righi-walkway.jpg', position: '50% 55%' },
    stats: [
      { value: 'Landmark', label: 'Luxury residence', text: 'A multi-generational family home in Eaglemont.' },
      { value: 'Infinity', label: 'Glass-free pool edge', text: 'The pool above lights the basement rumpus below.' },
      { value: 'Wellness', label: 'Infrared sauna · gym', text: 'A wellness suite and a gymnastics room.' },
      { value: '2 materials', label: 'Concrete & timber', text: 'Board-formed concrete and warm timber throughout.' },
    ],
  },
  about: {
    title: 'The Righi',
    text: [
      'Camillo’s landmark luxury home: a multi-generational family residence with a basement rumpus lit by the pool above, a gymnastics room, a wellness suite and a formal lounge.',
      'Built in board-formed concrete and warm timber throughout, with a glass-free infinity-edge pool, an infrared sauna and a gym.',
    ],
    images: [
      { file: 'Righi-courtyard.jpg', alt: 'A courtyard at The Righi between concrete walls and glazing', position: '50% 50%' },
      { file: 'Righi-living.jpg', alt: 'The living room at The Righi, with a long fireplace', position: '50% 50%' },
    ],
  },
};
