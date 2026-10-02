import * as THREE from 'three';
import { canvas, fbm, rng } from '../../gfx/proctex.js';
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
 * It only renders while some cloud is on screen.
 */
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (this.mobile ? 0.6 : 0.85));
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

  /** Generates the textures and puffs, a frame at a time so the page stays responsive. */
  async build() {
    const p = palette();
    const colors = { light: p.cloudLight, warm: p.cloudWarm, shade: p.cloudShade };
    const textures = [];
    for (let i = 0; i < (this.mobile ? 4 : 6); i++) {
      textures.push(cloudTexture(9173 + i * 811, colors));
      await nextFrame();
    }
    this.scene.add((this.sky = createSky(p)));

    const r = rng(4242);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const count = this.mobile ? 46 : 84;
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
        size: 0.42 + r() * 0.55, // × the half-height of the view at its depth
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

/**
 * One cumulus cloud on a canvas. A cauliflower form (big core blobs along a flat base, layers
 * of smaller bumps on top) with crisp edges and a little wispy fringe, shaded by self-shadowing:
 * each point is darkened by the cloud between it and the sun (upper left), which gives the
 * bright billows and grey bellies of a real cumulus.
 */
function cloudTexture(seed, { light, warm, shade }, S = 320) {
  const r = rng(seed);
  const baseY = S * 0.7;
  const blobs = [];
  for (let i = 0; i < 5; i++)
    blobs.push({ x: S * (0.3 + 0.4 * (i / 4) + (r() - 0.5) * 0.06), y: baseY - S * (0.08 + r() * 0.06), rad: S * (0.13 + r() * 0.05) });
  // bumps grow on the upper side of existing blobs: the billowing crown
  for (const [count, k] of [
    [16, 0.64],
    [16, 0.48],
  ]) {
    for (let i = 0; i < count; i++) {
      const parent = blobs[Math.floor(r() * blobs.length)];
      const a = Math.PI * (1.08 + r() * 0.84); // upper half (canvas y grows downwards)
      const rad = parent.rad * k * (0.8 + r() * 0.4);
      const x = parent.x + Math.cos(a) * parent.rad * 0.9;
      const y = Math.min(baseY - rad * 0.6, parent.y + Math.sin(a) * parent.rad * 0.9);
      if (x > S * 0.14 && x < S * 0.86 && y > S * 0.14) blobs.push({ x, y, rad });
    }
  }
  // density: compact smooth kernels, accumulated per blob over its bounding box only
  const D = new Float32Array(S * S);
  for (const b of blobs) {
    const x0 = Math.max(0, Math.floor(b.x - b.rad));
    const x1 = Math.min(S - 1, Math.ceil(b.x + b.rad));
    const y0 = Math.max(0, Math.floor(b.y - b.rad));
    const y1 = Math.min(S - 1, Math.ceil(b.y + b.rad));
    const r2 = b.rad * b.rad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / r2;
        if (q < 1) D[y * S + x] += (1 - q) * (1 - q);
      }
    }
  }
  const detail = fbm(S, 6, 5, seed);
  const fine = fbm(S, 24, 3, seed + 7);
  for (let y = 0; y < S; y++) {
    const flat = smooth((baseY + S * 0.035 - y) / (S * 0.05)); // flattish base
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      D[i] *= flat * (0.7 + 0.6 * detail[i]); // noise breaks up the outline
    }
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : D[(y | 0) * S + (x | 0)]);
  const L = rgb(light);
  const W = rgb(warm);
  const Sh = rgb(shade);
  const c = canvas(S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const step = S * 0.022;
  const lx = -0.5 * step;
  const ly = -0.87 * step;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const d = D[i];
      // crisp body plus a soft, noisy fringe
      const a = Math.max(smooth((d - 0.26) / 0.16), 0.35 * smooth((d - 0.1) / 0.16) * fine[i]);
      if (a <= 0.002) continue;
      // self-shadow: cloud density towards the sun
      let occ = 0;
      for (let k = 1; k <= 7; k++) occ += at(x + lx * k, y + ly * k);
      const sun = Math.exp(-occ * 0.3);
      const ambient = 0.35 + 0.3 * clamp01(1 - (y - S * 0.2) / (baseY - S * 0.2)); // brighter higher up
      const lit = clamp01(ambient * 0.5 + sun * 0.85 + (detail[i] - 0.5) * 0.1);
      const warmth = Math.pow(sun, 3) * 0.8; // sunlit rims pick up a warm tint
      for (let ch = 0; ch < 3; ch++) {
        const base = Sh[ch] + (L[ch] - Sh[ch]) * lit;
        img.data[i * 4 + ch] = base + (W[ch] - base) * warmth * 0.5;
      }
      img.data[i * 4 + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function rgb(hex) {
  const t = {};
  new THREE.Color(hex).getRGB(t, THREE.SRGBColorSpace);
  return [t.r * 255, t.g * 255, t.b * 255];
}
