import { cloudNoiseData } from '../../gfx/cloud-noise.js';

// Builds the cloud noise volume off the main thread: size → Uint8Array (size³ RGBA)
self.onmessage = ({ data: size }) => {
  const data = cloudNoiseData(size);
  self.postMessage(data, [data.buffer]);
};
