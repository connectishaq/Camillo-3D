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
  // the project page (as The London): figures over the hero photo, then "About the project"
  hero: {
    image: { file: 'MVRC-terrace.jpg', position: '50% 60%' },
    stats: [
      { value: 'Moonee Valley', label: 'Racecourse precinct', text: 'Part of the Moonee Valley Racecourse precinct renewal.' },
      { value: 'Generous', label: 'Balconies', text: 'Contemporary apartments opening onto generous balconies.' },
      { value: 'Bright', label: 'Kitchens', text: 'Bright, practical kitchens.' },
      { value: 'Rising now', label: 'Under construction', text: 'With a considered lobby to welcome residents home.' },
      { value: '3 materials', label: 'Façade', text: 'A precast façade with glazing and metal balustrades.' },
    ],
  },
  about: {
    title: 'MVRC – Thomas Street',
    text: [
      'Part of the Moonee Valley Racecourse precinct renewal: contemporary apartments with generous balconies, a considered lobby and bright, practical kitchens.',
      'Under construction in Moonee Ponds, the building pairs a precast façade with glazing and metal balustrades.',
    ],
    images: [
      {
        file: '191014_B_V03_SOUTHERN_FACADE-Large.jpeg',
        alt: 'Apartment balconies rising above the gardens on the southern façade',
        position: '50% 50%',
      },
      { file: 'MVRC-lobby.jpeg', alt: 'The lobby, with a curved timber wall and a pendant light', position: '45% 50%' },
    ],
  },
};
