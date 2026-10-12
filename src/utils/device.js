/**
 * A first guess at a modest device, before any frame has been drawn: few CPU cores, little
 * memory, or data saver on. Such devices start the 3D on lighter settings (CityStory,
 * Explorer, the clouds); everything else starts at full quality and only steps down if its
 * frames run slow (CityStory.adapt). Browsers that don't report a value count as capable.
 */
export function isLowPower() {
  const nav = navigator;
  const cores = nav.hardwareConcurrency || 8;
  const memory = nav.deviceMemory || 8; // GB, rounded down (Chromium only)
  return cores <= 4 || memory <= 4 || !!nav.connection?.saveData;
}
