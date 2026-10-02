/**
 * Company copy and contact details. Facts are from camillo.com.au (Sept 2026).
 * Plain data only (no imports): the build reads this file to write the static HTML.
 */
export const company = {
  name: 'Camillo',
  tagline: 'Residential & Commercial Builders',
  heritage: "The Melbourne construction company backed by 70 years' experience",
  about: [
    'Camillo specialises in bespoke residential and commercial construction across Melbourne and its suburbs.',
    'Evolved from Crema, we bring the procurement strength of a major builder to boutique projects under $50M — with the collaboration and personal service of a close-knit team.',
  ],
  promise: 'All the best bits of a big builder, and none of the bad.',
  services: [
    { title: 'Residential', text: 'Luxury homes and boutique apartment buildings, delivered with a craftsman’s eye for detail.' },
    { title: 'Commercial', text: 'Workplaces, hospitality and mixed-use buildings built to programme and budget.' },
    { title: 'Fit Outs', text: 'Interior fit outs that turn a shell into a space people want to be in.' },
  ],
  stats: [
    { value: 70, suffix: '+', label: 'Years of experience behind us' },
    { value: 50, prefix: '<$', suffix: 'M', label: 'Project sweet spot' },
    { value: 3, label: 'Core disciplines' },
  ],
  contact: {
    address: '262 Salmon Street, Port Melbourne VIC 3207',
    phone: '(03) 9644 1101',
    phoneHref: 'tel:+61396441101',
    email: 'enquiries@camillo.com.au',
    linkedin: 'https://www.linkedin.com/company/camillo-builders/',
    instagram: 'https://www.instagram.com/camillobuilders/',
  },
};

/**
 * Photos for the opening hero slide; one is picked at random on each visit
 * (from project-assets/, optimised by `npm run images`).
 */
export const introImages = [
  { project: 'la-storia', file: 'IMG_10350_038-1200x800.jpg', position: '50% 60%', alt: 'La Storia, Carlton, at dusk' },
  {
    project: 'mvrc-thomas-street',
    file: '181219_EXTERIOR_PARK-Copy-Large-1200x800.jpeg',
    position: '50% 50%',
    alt: 'MVRC – Thomas Street, Moonee Ponds, from the park',
  },
  {
    project: 'la-storia',
    file: 'DUGA11024_La-Storia_E02_Hero-Cardigan-St_Crop-1600x1726.jpg',
    position: '50% 62%',
    alt: 'La Storia, Carlton, from Cardigan Street',
  },
];

/** Other portfolio names (no published location yet), shown as a strip in "What we build". */
export const moreProjects = [
  'United Co.',
  'Feehan Row – MVRC',
  'Highpark Seasons',
  'Pavillion Green',
  'Springfield',
  'Collections XI',
  "Viv's Place, Dandenong",
];
