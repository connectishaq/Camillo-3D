/** Shared naming for the optimised project photos (scripts/images.mjs and the templates). */
export const IMAGE_WIDTHS = [640, 1280, 1920];

/** `la-storia` + `IMG_10350_038-1200x800.jpg` → `la-storia-img-10350-038` */
export const imageName = (project, file) =>
  `${project}-${file
    .replace(/\.[a-z]+$/i, '')
    .replace(/-?\d{3,4}x\d{3,4}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}`;
