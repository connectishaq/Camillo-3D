/**
 * The About section's 2D map around the head office (sections/about/hq-map.html), drawn by
 * `npm run map` (scripts/hq-map.mjs) from OpenStreetMap data into
 * public/images/map/hq-map.svg, with the label positions in src/data/hq-map.json.
 * Plain data only: the build and the map script both read it. Coordinates are [lng, lat].
 */
export const hqMap = {
  // the area drawn: Port Melbourne, from Westgate Park across to Southbank, down to the bay
  bbox: { west: 144.893, east: 144.985, north: -37.806, south: -37.856 },
  // suburbs, in large quiet type
  areas: [
    { name: 'Port Melbourne', coords: [144.9233, -37.8352] },
    { name: 'Fishermans Bend', coords: [144.9229, -37.8236] },
    { name: 'South Melbourne', coords: [144.9571, -37.8334] },
    { name: 'Southbank', coords: [144.964, -37.8262] },
    { name: 'Docklands', coords: [144.9436, -37.8183] },
    { name: 'Albert Park', coords: [144.9608, -37.8454] },
  ],
  // places, with a dot
  places: [
    { name: 'Station Pier', coords: [144.9317, -37.8442] },
    { name: 'Princes Pier', coords: [144.9266, -37.8413] },
    { name: 'Westgate Park', coords: [144.9076, -37.8313] },
    { name: 'South Melbourne Market', coords: [144.9565, -37.8323] },
    { name: 'Albert Park Lake', coords: [144.9707, -37.8459] },
    { name: 'Southern Cross', coords: [144.9524, -37.8184] },
    { name: 'Crown Melbourne', coords: [144.9587, -37.8233] },
  ],
  // water names, in italics
  waters: [
    { name: 'Port Phillip Bay', coords: [144.925, -37.851] },
    { name: 'Yarra River', coords: [144.934, -37.8226] },
  ],
  // streets to name along their line (the longest straight stretch on screen)
  roads: [
    'Williamstown Road',
    'Salmon Street',
    'Plummer Street',
    'Lorimer Street',
    'Bay Street',
    'Beaconsfield Parade',
    'Ingles Street',
    'City Road',
    'Kings Way',
    'Montague Street',
    'Graham Street',
    'Todd Road',
  ],
  // straight-line distances from the head office, shown beside the map
  distances: [
    { name: 'The London', note: 'Our project, Port Melbourne', coords: [144.9369, -37.8434] },
    { name: 'Station Pier', note: 'Port Melbourne', coords: [144.9317, -37.8442] },
    { name: 'Melbourne CBD', note: 'City centre', coords: [144.9631, -37.8136] },
  ],
};
