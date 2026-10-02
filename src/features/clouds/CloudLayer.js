import * as THREE from 'three';
import { rng } from '../../gfx/noise.js';
import { cloudPixels } from './cloud-pixels.js';
import { palette } from '../../gfx/palette.js';
import { isMobile, nextFrame } from '../../utils/dom.js';

/*
 * A bank of soft 3D clouds in front of the map, for the Featured Projects chapter.
 *
 * Its own small transparent WebGL canvas between the map stage and the story text, so it
 * works over every map mode. Dozens of cumulus "puffs" (procedural, sunlit textures) sit at
 * different depths in front of a fixed camera, over a pale sky. Two values drive it:
 *   cover 0 → 1  the clouds roll in towards the camera until they fill the view
 *   part  0 → 1  they split sideways from the centre (nearer ones faster) and fade out
 * It only renders while some cloud is on screen, at reduced resolution, and its textures are
 * generated in a web worker so building it never blocks scrolling.
 */
const TEXTURE_SIZE = 256;
const FOV = 50;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export class CloudLayer {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.mobile = isMobile();
    this.state = { cover: 0, part: 0 };
    this.time = 0;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    // clouds are soft: a reduced resolution looks the same and costs far less
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (this.mobile ? 0.45 : 0.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
    this.loop = this.loop.bind(this);
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  /** Generates the textures (in a worker) and the puffs. */
  async build() {
    const p = palette();
    const colors = { light: rgb(p.cloudLight), warm: rgb(p.cloudWarm), shade: rgb(p.cloudShade) };
    const seeds = Array.from({ length: this.mobile ? 3 : 5 }, (_, i) => 9173 + i * 811);
    const textures = (await generatePixels(seeds, colors)).map((px) => {
      const tex = new THREE.DataTexture(px, TEXTURE_SIZE, TEXTURE_SIZE);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return tex;
    });
    this.scene.add((this.sky = createSky(p)));

    const r = rng(4242);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const count = this.mobile ? 26 : 44;
    const puffs = [];
    for (let i = 0; i < count; i++) {
      // more puffs close to the camera, where each covers more of the view
      const z = 70 + Math.pow(r(), 1.3) * 760;
      const nx = (r() * 2 - 1) * 1.3;
      const material = new THREE.MeshBasicMaterial({
        map: textures[i % textures.length],
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      puffs.push({
        mesh,
        z,
        nx,
        // a sea of cloud: most of it below the eye line, distant tops near the horizon
        ny: -1.05 + Math.pow(r(), 0.75) * 1.7,
        size: 0.55 + r() * 0.6, // × the half-height of the view at its depth
        alpha: 0.9 + r() * 0.1,
        near: 1 - (z - 70) / 760, // 1 = closest
        side: nx < 0 ? -1 : 1,
        phase: r() * Math.PI * 2,
        speed: 0.05 + r() * 0.08,
        spin: (r() - 0.5) * 0.012,
        rot: (r() - 0.5) * 0.5,
        lift: r() - 0.3,
      });
    }
    // far first, near last: correct overlap without depth testing
    puffs
      .sort((a, b) => b.z - a.z)
      .forEach((pf, i) => {
        pf.mesh.renderOrder = i;
        this.scene.add(pf.mesh);
      });
    this.puffs = puffs;
    // upload textures and compile shaders now, not on the first visible frame (no hitch)
    textures.forEach((tex) => this.renderer.initTexture(tex));
    this.renderer.compile(this.scene, this.camera);
    this.ready = true;
    this.set(this.state);
  }

  /** Scroll state: `cover` rolls the clouds in, `part` splits them away. */
  set({ cover = this.state.cover, part = this.state.part }) {
    this.state = { cover: clamp01(cover), part: clamp01(part) };
    const visible = this.ready && this.state.cover > 0.001 && this.state.part < 0.999;
    if (visible === this.active) return;
    this.active = visible;
    this.container.classList.toggle('is-active', visible);
    this.renderer.setAnimationLoop(visible ? this.loop : null);
    if (visible) this.last = undefined;
  }

  loop(now) {
    const dt = this.last === undefined ? 0.016 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.reducedMotion) this.time += dt;
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  update() {
    const { cover, part } = this.state;
    const t = this.time;
    const aspect = this.camera.aspect;
    const still = this.reducedMotion; // fades only, no movement
    for (const pf of this.puffs) {
      // roll in: far puffs a little before near ones, each gliding towards the camera
      const e = smooth((cover - 0.35 * pf.near) / 0.65);
      // part: the centre opens first, nearer puffs move further (parallax)
      const q = smooth((part - 0.3 * Math.min(1, Math.abs(pf.nx))) / 0.7);
      const z = still ? pf.z : pf.z * (1 + 1.3 * (1 - e));
      const hh = TAN * pf.z; // half-height of the view at the puff's resting depth
      const drift = still ? 0 : Math.sin(t * pf.speed + pf.phase) * 0.04;
      const x = (pf.nx + drift) * hh * aspect + (still ? 0 : pf.side * q * hh * aspect * (1.5 + pf.near * 1.4));
      const y = (pf.ny + (still ? 0 : Math.sin(t * pf.speed * 0.7 + pf.phase) * 0.02)) * hh + (still ? 0 : q * hh * 0.12 * pf.lift);
      pf.mesh.position.set(x, y, -z);
      pf.mesh.scale.setScalar(pf.size * hh * 2);
      pf.mesh.rotation.z = pf.rot + t * pf.spin;
      // solid while they slide away, fading only at the end
      pf.mesh.material.opacity = pf.alpha * e * (1 - smooth((q - 0.5) / 0.5));
    }
    // the sky clears first, so the map shows through the opening gap
    this.sky.material.uniforms.uOpacity.value = smooth(cover) * (1 - smooth(part * 2.4));
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.active) this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Full-screen pale sky behind the puffs, brighter towards the sun (upper left). */
function createSky(p) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(p.cloudSkyTop) },
      uBottom: { value: new THREE.Color(p.cloudSkyBottom) },
      uGlow: { value: new THREE.Color(p.cloudWarm) },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
        float sun = smoothstep(0.75, 0.0, distance(vUv, vec2(0.2, 0.95)));
        gl_FragColor = vec4(mix(c, uGlow, sun * 0.55), uOpacity);
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

/** Pixels from a web worker; on the main thread (a frame per texture) if workers aren't available. */
async function generatePixels(seeds, colors) {
  try {
    const worker = new Worker(new URL('./cloud-textures.worker.js', import.meta.url), { type: 'module' });
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => (worker.terminate(), resolve(data));
      worker.onerror = (e) => (worker.terminate(), reject(e));
      worker.postMessage({ seeds, colors, size: TEXTURE_SIZE });
    });
  } catch {
    const out = [];
    for (const seed of seeds) {
      out.push(cloudPixels(seed, colors, TEXTURE_SIZE));
      await nextFrame();
    }
    return out;
  }
}

function rgb(hex) {
  const t = {};
  new THREE.Color(hex).getRGB(t, THREE.SRGBColorSpace);
  return [t.r * 255, t.g * 255, t.b * 255];
}
