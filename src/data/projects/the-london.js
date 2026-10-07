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
  // hero / card photo from project-assets/the-london/ (optimised by `npm run images`)
  image: { file: 'TheLondon.jpeg', position: '50% 55%' },
  camera: { zoom: 17.4, pitch: 64, bearing: -40 },
  // the project page's full-screen hero (pages/project/hero.js): the photo, the name rising over
  // it, then these figures in boxes (all from the published facts above). Projects without
  // `hero` keep the plain page header.
  hero: {
    stats: [
      { value: '7 levels', label: 'Residential · complete', text: 'A seven-level building facing the Port Melbourne foreshore.' },
      { value: '13 residences', label: 'Luxury apartments', text: 'Uninterrupted views across Port Phillip Bay from every one.' },
      { value: 'Est. 1861', label: 'The London Hotel', text: 'Built on the historic site of the original London Hotel.' },
      { value: 'Opposite', label: 'The beach & Station Pier', text: 'Beachside living, across the road from the sand.' },
      { value: '4 materials', label: 'Crafted façade', text: 'Brickwork, raw concrete, charcoal metalwork and timber soffits.' },
    ],
  },
  // the project page's "About the project" (pages/project/about.html): a big photo, the title
  // and copy beside it, a small photo below. Photos from project-assets/the-london/.
  about: {
    title: 'The London',
    text: [
      'Built on the site of the original London Hotel, established in 1861, The London reimagines beachside living in Port Melbourne, opposite the beach and Station Pier.',
      'Seven levels hold thirteen luxury apartments, each with uninterrupted views across Port Phillip Bay. The façade is crafted in brickwork, raw concrete, charcoal metalwork and timber soffits.',
    ],
    images: [
      {
        file: 'TheLondon-balcony.jpg',
        alt: 'A balcony at The London, under timber soffits, looking out to the foreshore',
        position: '50% 50%',
      },
      { file: 'TheLondon-living.jpg', alt: 'A living room at The London, with floor-to-ceiling windows', position: '40% 50%' },
    ],
  },
  // published numbers the 3D model must reproduce (checked in dev)
  publishedFacts: { levels: 7, units: 13 },
};
