import { cloudPixels } from './cloud-pixels.js';

// Generates the cloud textures off the main thread: { seeds, colors, size } → [Uint8ClampedArray]
self.onmessage = ({ data: { seeds, colors, size } }) => {
  const textures = seeds.map((seed) => cloudPixels(seed, colors, size));
  self.postMessage(
    textures,
    textures.map((t) => t.buffer),
  );
};
