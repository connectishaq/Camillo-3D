import { modelFor, checkFacts } from './models/index.js';

/**
 * Single source of truth for all site content.
 * Facts are taken from camillo.com.au (Sept 2026). Coordinates are approximate
 * site locations — confirm exact lat/lng with the Camillo team before launch.
 *
 * `model` drives the procedural 3D massing in the Building Explorer. Where Camillo
 * has not published a level count, the model is marked `indicative: true` and the
 * UI labels it as an illustrative massing, not a construction drawing.
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

/** Camera presets for the non-project chapters. [lng, lat] */
export const cameras = {
  hero: { center: [144.9631, -37.8136], zoom: 14.6, pitch: 62, bearing: -20 },
  office: { center: [144.9246, -37.8309], zoom: 16.8, pitch: 60, bearing: 35 },
  projectsIntro: { center: [144.975, -37.83], zoom: 11.4, pitch: 45, bearing: -10 },
  overview: { center: [144.99, -37.845], zoom: 10.9, pitch: 35, bearing: 0 },
  contact: { center: [144.9246, -37.8309], zoom: 15.4, pitch: 55, bearing: -30 },
};

export const office = {
  name: 'Camillo HQ',
  coords: [144.9246, -37.8309],
};

export const projects = [
  {
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
    model: {
      style: 'brick',
      width: 24,
      depth: 20,
      floors: [
        { label: 'Ground', program: 'lobby', units: 3 },
        { label: 'Level 1', program: 'apartments', units: 3 },
        { label: 'Level 2', program: 'apartments', units: 3 },
        { label: 'Level 3', program: 'whole-floor', units: 1 },
        { label: 'Level 4', program: 'whole-floor', units: 1 },
        { label: 'Level 5', program: 'whole-floor', units: 1 },
        { label: 'Level 6', program: 'whole-floor', units: 1, setback: 2 },
      ],
    },
  },
  {
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
    camera: { zoom: 17.3, pitch: 62, bearing: 25 },
    model: {
      style: 'stone',
      indicative: true,
      width: 30,
      depth: 22,
      floors: [
        { label: 'Ground', program: 'lobby', units: 2 },
        { label: 'Level 1', program: 'apartments', units: 3 },
        { label: 'Level 2', program: 'apartments', units: 3 },
        { label: 'Level 3', program: 'apartments', units: 3 },
        { label: 'Level 4', program: 'apartments', units: 3 },
        { label: 'Level 5', program: 'apartments', units: 3 },
        { label: 'Level 6', program: 'apartments', units: 2, setback: 2 },
        { label: 'Level 7', program: 'apartments', units: 2, setback: 3 },
      ],
    },
  },
  {
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
    camera: { zoom: 17.4, pitch: 60, bearing: -15 },
    model: {
      style: 'stone',
      indicative: true,
      width: 26,
      depth: 24,
      floors: [
        { label: 'Ground', program: 'lobby', units: 2 },
        { label: 'Level 1', program: 'apartments', units: 2 },
        { label: 'Level 2', program: 'apartments', units: 2 },
        { label: 'Level 3', program: 'whole-floor', units: 1, setback: 2 },
      ],
    },
  },
  {
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
    model: {
      style: 'glass',
      width: 48,
      depth: 26,
      floors: [
        { label: 'Ground', program: 'lobby', units: 8 },
        { label: 'Level 1', program: 'apartments', units: 12 },
        { label: 'Level 2', program: 'apartments', units: 12 },
        { label: 'Level 3', program: 'apartments', units: 12 },
        { label: 'Level 4', program: 'apartments', units: 11, setback: 1.5 },
        { label: 'Level 5', program: 'penthouse', units: 9, setback: 3 },
      ],
    },
  },
  {
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
    camera: { zoom: 17.8, pitch: 60, bearing: 20 },
    model: {
      style: 'house',
      indicative: true,
      width: 22,
      depth: 16,
      pool: true,
      floors: [
        { label: 'Basement', program: 'rumpus', units: 1 },
        { label: 'Ground', program: 'living', units: 1 },
        { label: 'Upper', program: 'bedrooms', units: 1, setback: 2 },
      ],
    },
  },
  {
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
    camera: { zoom: 17, pitch: 62, bearing: -60 },
    model: {
      style: 'glass',
      indicative: true,
      width: 40,
      depth: 22,
      floors: [
        { label: 'Ground', program: 'lobby', units: 4 },
        { label: 'Level 1', program: 'apartments', units: 8 },
        { label: 'Level 2', program: 'apartments', units: 8 },
        { label: 'Level 3', program: 'apartments', units: 8 },
        { label: 'Level 4', program: 'apartments', units: 8 },
        { label: 'Level 5', program: 'apartments', units: 6, setback: 2 },
        { label: 'Level 6', program: 'apartments', units: 4, setback: 4 },
      ],
    },
  },
];

/*
 * Building models come from src/data/models/<slug>.json (written from the reference
 * images in project-assets/<slug>/). The inline `model` above is only a fallback for
 * a project without a spec.
 */
projects.forEach((p) => {
  p.model = modelFor(p.slug, p.model);
});

// Published facts the models must reproduce.
const FACTS = { 'the-london': { levels: 7, units: 13 }, 'sea-sky': { levels: 6, units: 64 } };
if (import.meta.env.DEV) {
  projects.forEach((p) => {
    const issues = FACTS[p.slug] && p.model.bands ? checkFacts(p.model, FACTS[p.slug]) : [];
    if (issues.length) console.warn(`[models] ${p.slug} does not match published facts:`, issues.join(', '));
  });
}

/** Other portfolio names (no published location yet) — shown as a strip. */
export const moreProjects = [
  'United Co.',
  'Feehan Row – MVRC',
  'Highpark Seasons',
  'Pavillion Green',
  'Springfield',
  'Collections XI',
  "Viv's Place, Dandenong",
];
