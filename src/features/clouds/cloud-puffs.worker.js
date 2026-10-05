import { puffPixels } from '../../gfx/smoke.js';

// Makes the cloud puff textures off the main thread: { seeds, size } → [Uint8ClampedArray]
self.onmessage = ({ data: { seeds, size } }) => {
  const puffs = seeds.map((seed) => puffPixels(seed, size));
  self.postMessage(
    puffs,
    puffs.map((p) => p.buffer),
  );
};
