/**
 * The Gallery section: project photos, in the order they appear. Originals live in
 * project-assets/<project>/; `npm run images` writes the optimised copies (public/images/projects).
 * `project` is a project slug (its name links the photo to the project page); `footer: true`
 * also puts that photo beside the enquiry form in the footer, `services: true` in the corner of
 * What we build.
 * Plain data only (no imports): the build reads this file to write the static HTML.
 */
export const gallery = [
  { project: 'the-london', file: 'TheLondon.jpeg', alt: 'The London from above, with the Melbourne CBD skyline behind', services: true },
  {
    project: 'la-storia',
    file: 'DUGA11024_La-Storia_E02_Hero-Cardigan-St_Crop-1600x1726.jpg',
    alt: 'La Storia seen across the park from Cardigan Street',
  },
  {
    project: 'mvrc-thomas-street',
    file: '181219_EXTERIOR_PARK-Copy-Large-1200x800.jpeg',
    alt: 'Brick and white-framed townhouses behind a landscaped front garden',
  },
  { project: 'sea-sky', file: 'EXT02_Garden-800x993.jpg', alt: 'A winding path through the planted courtyard garden at Sea & Sky' },
  { project: 'la-storia', file: 'IMG_10350_038-1200x800.jpg', alt: 'La Storia at dusk, its windows lit above the street', footer: true },
  { project: 'the-lansell', file: 'S010-1-Render-Hero-Street.jpeg', alt: 'The Lansell: a glass-fronted upper level among mature trees' },
  {
    project: 'mvrc-thomas-street',
    file: '191014_B_V03_SOUTHERN_FACADE-Large-800x1000.jpeg',
    alt: 'Apartment balconies rising above the gardens on the southern façade',
  },
  { project: 'the-righi', file: '05-Bedroom-Windows.jpg', alt: 'The Righi’s pale stone façade with deep-set windows' },
  { project: 'sea-sky', file: 'EXT01_Exterior-1600x1702.jpg', alt: 'Sea & Sky’s apartments framing a flowering courtyard' },
  {
    project: 'mvrc-thomas-street',
    file: '191023_C_V01_HERO-Large.jpeg',
    alt: 'A long, low apartment building with planted terraces across a lawn',
  },
  { project: 'la-storia', file: 'IMG_10058_2_040.jpg', alt: 'La Storia’s white-framed corner façade' },
];
