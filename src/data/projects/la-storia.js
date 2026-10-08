/** Featured project. See README → "Adding a project". The 3D model comes from data/models/<slug>.json. */
export default {
  order: 2,
  slug: 'la-storia',
  name: 'La Storia',
  suburb: 'Carlton',
  address: '88 Pelham Street, Carlton',
  type: 'Residential',
  status: 'Topped out',
  coords: [144.9656, -37.8027],
  facts: [
    ['Residences', '21 three-bedroom homes'],
    ['Inspiration', 'Carlo Scarpa modernism'],
    ['Appliances', 'Smeg · Sub-Zero · Astra Walker'],
  ],
  summary:
    'A monument to Carlton’s Italian heritage. The plan was pared back from 46 apartments to 21 generous family homes — marble, concrete and handcrafted detail, flooded with light and air.',
  materials: 'Marble, concrete, handcrafted joinery, solar and energy-efficient systems.',
  // hero / card photo from project-assets/la-storia/ (optimised by `npm run images`)
  image: { file: 'IMG_10058_2_040.jpg', position: '50% 45%' },
  camera: { zoom: 17.3, pitch: 62, bearing: 25 },
  // the project page (as The London): figures over the hero photo, then "About the project"
  hero: {
    stats: [
      { value: '21 homes', label: 'Three-bedroom residences', text: 'Generous family homes at 88 Pelham Street, Carlton.' },
      { value: 'From 46', label: 'Apartments, pared back', text: 'The plan was pared back from 46 apartments to 21 homes.' },
      { value: 'Scarpa', label: 'Design inspiration', text: 'The modernism of Carlo Scarpa, in marble, concrete and handcrafted detail.' },
      { value: 'Topped out', label: 'Residential', text: 'A monument to Carlton’s Italian heritage.' },
      { value: 'Solar', label: 'Energy-efficient', text: 'Solar and energy-efficient systems built in.' },
    ],
  },
  about: {
    title: 'La Storia',
    text: [
      'A monument to Carlton’s Italian heritage. The plan was pared back from 46 apartments to 21 generous family homes, flooded with light and air.',
      'Inspired by the modernism of Carlo Scarpa, the homes are made of marble, concrete and handcrafted joinery, with Smeg, Sub-Zero and Astra Walker appointments and solar, energy-efficient systems.',
    ],
    images: [
      {
        file: 'DUGA11024_La-Storia_E02_Hero-Cardigan-St_Crop.jpg',
        alt: 'La Storia seen across the park from Cardigan Street',
        position: '50% 50%',
      },
      { file: 'LaStoria-balcony.jpg', alt: 'A balcony at La Storia looking out to the city skyline', position: '55% 50%' },
    ],
  },
};
