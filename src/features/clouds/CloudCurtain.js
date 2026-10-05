import * as THREE from 'three';
import { palette } from '../../gfx/palette.js';
import { rng } from '../../gfx/noise.js';
import { isMobile } from '../../utils/dom.js';
import { puffPixels } from '../../gfx/smoke.js';

/*
 * A curtain of cloud behind the Featured Projects heading, in its own transparent canvas
 * between the map and the text (it isn't part of the map).
 *
 * Built like photo-real cloud: dozens of soft, wispy smoke puffs (gfx/smoke.js), each partly
 * transparent, layered at three depths into a left and a right bank with billowing tops,
 * over a soft white wash that keeps the heading easy to read. Two values drive it:
 *   cover 0 → 1  the banks drift in and thicken behind the text
 *   part  0 → 1  they slide apart, left to the left and right to the right (nearer puffs
 *                faster), thinning as they go, revealing the map
 * Rendered at reduced resolution and only while some cloud is on screen.
 */
const SIZE = 320;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const LAYERS = [
  // far → near: puff size (× half the screen height), slide speed, opacity, share of puffs
  { size: [0.4, 0.7], speed: 0.9, alpha: [0.5, 0.75], share: 0.4 },
  { size: [0.6, 1.0], speed: 1.35, alpha: [0.55, 0.85], share: 0.35 },
  { size: [0.9, 1.4], speed: 1.9, alpha: [0.6, 0.9], share: 0.25 },
];

export class CloudCurtain {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.mobile = isMobile();
    this.state = { cover: 0, part: 0 };
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (this.mobile ? 0.45 : 0.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.loop = this.loop.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  /** Makes the puff textures (in a web worker when possible) and lays out the banks. */
  async build() {
    const seeds = Array.from({ length: this.mobile ? 5 : 8 }, (_, i) => 4111 + i * 977);
    const textures = (await generatePuffs(seeds)).map((px) => {
      const t = new THREE.DataTexture(px, SIZE, SIZE);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
      return t;
    });
    const p = palette();
    this.scene.add((this.wash = createWash(p)));

    const r = rng(2026);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const total = this.mobile ? 56 : 92;
    const tint = new THREE.Color(p.cloudLight);
    this.puffs = [];
    LAYERS.forEach((layer, li) => {
      const count = Math.round(total * layer.share);
      for (let i = 0; i < count; i++) {
        // spread across the screen; a band with billowing tops, denser low down
        const nx = (i / count) * 2.4 - 1.2 + (r() - 0.5) * 0.25;
        const ny = -1.05 + Math.pow(r(), 0.85) * 1.85;
        const material = new THREE.MeshBasicMaterial({
          map: textures[Math.floor(r() * textures.length)],
          color: tint,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          opacity: 0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = li * 1000 + Math.round((1 - ny) * 100); // far first; lower puffs over higher
        mesh.rotation.z = (r() - 0.5) * 0.35;
        this.scene.add(mesh);
        this.puffs.push({
          mesh,
          nx,
          ny,
          side: nx < 0 ? -1 : 1,
          flip: r() < 0.5 ? -1 : 1, // mirror some for variety
          size: layer.size[0] + r() * (layer.size[1] - layer.size[0]),
          stretch: 1.25 + r() * 0.45, // wider than tall, like a bank
          alpha: layer.alpha[0] + r() * (layer.alpha[1] - layer.alpha[0]),
          speed: layer.speed * (0.85 + r() * 0.3),
          delay: r() * 0.35,
          phase: r() * Math.PI * 2,
          drift: 0.004 + r() * 0.006,
        });
      }
    });
    this.resize();
    textures.forEach((t) => this.renderer.initTexture(t));
    this.renderer.compile(this.scene, this.camera);
    this.ready = true;
    this.set(this.state);
  }

  /** Scroll state: `cover` brings the banks in, `part` slides them apart. */
  set({ cover = this.state.cover, part = this.state.part }) {
    this.state = { cover, part };
    if (!this.ready) return;
    this.layout(this.time || 0);
    const visible = cover > 0.001 && part < 0.999;
    if (visible === this.active) return;
    this.active = visible;
    this.container.classList.toggle('is-active', visible);
    this.renderer.setAnimationLoop(visible ? this.loop : null);
  }

  layout(t) {
    const { cover, part } = this.state;
    const aspect = this.aspect || 1;
    const move = this.reducedMotion ? 0 : 1;
    const slide = Math.pow(part, 1.15);
    for (const pf of this.puffs) {
      const e = smooth((cover - pf.delay) / 0.6);
      const gone = smooth((part - 0.35) / 0.6); // thin out as they part
      const drift = Math.sin(t * pf.drift * 6 + pf.phase) * 0.03 * move;
      const x = (pf.nx + drift) * aspect + pf.side * slide * pf.speed * (aspect + pf.size) * move;
      const y = pf.ny + (1 - e) * 0.25 * move; // settle in from slightly below
      pf.mesh.position.set(x, y, 0);
      const s = pf.size * (0.92 + 0.08 * e);
      pf.mesh.scale.set(pf.flip * s * pf.stretch, s, 1);
      pf.mesh.material.opacity = pf.alpha * e * (1 - gone);
    }
    // the wash keeps the heading readable, and clears first so the map shows through the gap
    this.wash.material.uniforms.uOpacity.value = smooth(cover) * (1 - smooth(part / 0.45)) * 0.88;
  }

  loop(now) {
    this.time = now / 1000;
    if (!this.reducedMotion) this.layout(this.time);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    Object.assign(this.camera, { left: -this.aspect, right: this.aspect, top: 1, bottom: -1 });
    this.camera.updateProjectionMatrix();
    if (this.ready) this.layout(this.time || 0);
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Soft white wash behind the puffs: brightest where the heading sits, softer at the edges. */
function createWash(p) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(p.cloudLight) },
      uEdge: { value: new THREE.Color(p.cloudShade) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uEdge; uniform float uOpacity; varying vec2 vUv;
      void main() {
        float r = length((vUv - 0.5) * vec2(1.0, 1.3));
        vec3 c = mix(uColor, mix(uColor, uEdge, 0.35), smoothstep(0.2, 0.8, r));
        gl_FragColor = vec4(c, uOpacity * (1.0 - smoothstep(0.55, 0.95, r) * 0.25));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** Puff pixels from a web worker; on the main thread if workers aren't available. */
async function generatePuffs(seeds) {
  try {
    const worker = new Worker(new URL('./cloud-puffs.worker.js', import.meta.url), { type: 'module' });
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => (worker.terminate(), resolve(data));
      worker.onerror = (e) => (worker.terminate(), reject(e));
      worker.postMessage({ seeds, size: SIZE });
    });
  } catch {
    return seeds.map((s) => puffPixels(s, SIZE));
  }
}
