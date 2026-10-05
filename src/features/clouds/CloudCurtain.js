import * as THREE from 'three';
import { palette } from '../../gfx/palette.js';
import { isMobile } from '../../utils/dom.js';
import { cloudNoiseData } from '../../gfx/cloud-noise.js';

/*
 * A curtain of cloud behind the Featured Projects heading, in its own transparent canvas
 * between the map and the text (it isn't part of the map).
 *
 * One full-screen shader. Two cloud masses, left and right, each at two depths (far and
 * near), are drawn from a tileable 3D cloud-noise volume: domed billows with eroded, wispy
 * edges, lit from the upper left (bright crowns, grey-blue bellies). Two values drive it:
 *   cover 0 → 1  the bank thickens until it fills the screen behind the text
 *   part  0 → 1  the masses slide apart, the left one to the left and the right one to the
 *                right (the near layer faster, for depth), revealing the map
 * Drawn at reduced resolution (clouds are soft) and only while some cloud is on screen.
 */
const NOISE_SIZE = 64;

export class CloudCurtain {
  constructor(container, { reducedMotion = false } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.state = { cover: 0, part: 0 };
    const mobile = isMobile();
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (mobile ? 0.4 : 0.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.loop = this.loop.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  /** Builds the noise volume (in a web worker when possible) and compiles the shader. */
  async build() {
    const data = await generateNoise();
    const noise = new THREE.Data3DTexture(data, NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
    noise.format = THREE.RGBAFormat;
    noise.wrapS = noise.wrapT = noise.wrapR = THREE.RepeatWrapping;
    noise.magFilter = noise.minFilter = THREE.LinearFilter;
    noise.needsUpdate = true;
    const p = palette();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uNoise: { value: noise },
        uCover: { value: 0 },
        uPart: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uMotion: { value: this.reducedMotion ? 0 : 1 },
        uLight: { value: new THREE.Color(p.cloudLight) },
        uWarm: { value: new THREE.Color(p.cloudWarm) },
        uShade: { value: new THREE.Color(p.cloudShade) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp sampler3D;
        uniform sampler3D uNoise;
        uniform float uCover, uPart, uTime, uAspect, uMotion;
        uniform vec3 uLight, uWarm, uShade;
        varying vec2 vUv;

        vec4 tex(vec2 p, float z) { return texture(uNoise, vec3(p, z)); }

        // billowy cumulus field: large forms, domain-warped so they round and fold like real
        // cloud, with a little fine erosion on top
        float field(vec2 p, float z) {
          vec2 w = vec2(tex(p * 0.09, z).r, tex(p * 0.09 + 0.47, z + 0.31).r) - 0.5;
          p += w * 1.6;
          float a = tex(p * 0.19, z).r;
          float b = tex(p * 0.34 + 0.21, z + 0.17).r;
          float d = tex(p * 1.1 + 0.63, z + 0.53).g;
          return a * 0.68 + b * 0.32 - (1.0 - d) * 0.07;
        }

        // one mass on one side (-1 left, +1 right) of one layer: { density, light, puff }
        vec3 mass(vec2 uv, float side, float speed, float scale, float z) {
          float shift = side * pow(uPart, 0.8) * speed;             // slides outwards
          vec2 p = vec2((uv.x - shift) * uAspect, uv.y) * scale;    // the clouds travel with it
          p += vec2(side * 3.7 + uTime * 0.01 * uMotion, z * 5.0);
          float n = field(p, z);
          // at rest the masses overlap across the whole screen; as they part, the inner edge shows
          float edge = side * (uv.x - shift) + (n - 0.5) * 0.7;
          float reach = smoothstep(-0.9 + uPart * 0.6, -0.15 + uPart * 0.25, edge);
          float threshold = mix(1.15, 0.05, uCover);
          float dens = smoothstep(threshold, threshold + 0.22, n * reach + reach * 0.12);
          // cumulus puffs: rounded forms with defined edges, rising out of the softer base
          float puff = smoothstep(0.5, 0.6, n);
          // light from the upper left: puff edges facing the sun are bright, the far side shaded
          vec2 toSun = vec2(-0.07, 0.11);
          float puff2 = smoothstep(0.5, 0.6, field(p + toSun, z));
          float lit = clamp(0.62 + (puff - puff2) * 0.55 + (n - 0.55) * 0.9 + uv.y * 0.1, 0.0, 1.0);
          return vec3(dens, lit, puff);
        }

        vec4 over(vec4 top, vec4 under) {
          return vec4(top.rgb * top.a + under.rgb * under.a * (1.0 - top.a), top.a + under.a * (1.0 - top.a));
        }

        vec4 shade(vec3 m) {
          // base: soft blue-grey haze; puffs: white with sunlit crowns and grey bellies
          vec3 base = mix(uShade, uLight, 0.55);
          vec3 puffCol = mix(uShade, uLight, smoothstep(0.2, 0.85, m.y));
          puffCol = mix(puffCol, uWarm, smoothstep(0.82, 1.0, m.y) * 0.45);
          return vec4(mix(base, puffCol, 0.35 + 0.65 * m.z), m.x);
        }

        // the left and right masses mixed by their densities: no seam where they overlap
        vec4 blend(vec3 l, vec3 r) {
          float w = l.x + r.x + 1e-4;
          vec3 m = vec3(max(l.x, r.x), (l.y * l.x + r.y * r.x) / w, (l.z * l.x + r.z * r.x) / w);
          return shade(m);
        }

        void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          float z = uTime * 0.004 * uMotion;
          // far layer: slower, smaller billows; near layer: faster, bigger
          vec3 fl = mass(uv, -1.0, 1.15, 1.0, z);
          vec3 fr = mass(uv, 1.0, 1.15, 1.0, z + 0.5);
          vec3 nl = mass(uv, -1.0, 1.9, 0.62, z + 0.25);
          vec3 nr = mass(uv, 1.0, 1.9, 0.62, z + 0.75);
          vec4 far = blend(fl, fr);
          vec4 near = blend(nl, nr);
          near.rgb = mix(near.rgb, uShade, 0.08);                     // a touch of depth haze
          vec4 c = over(near, far);
          // reduced motion: no sliding, the curtain simply fades as it "parts"
          c.a *= mix(1.0, 1.0 - smoothstep(0.1, 0.9, uPart), 1.0 - uMotion);
          // premultiplied output
          gl_FragColor = vec4(c.rgb, c.a);
          #include <colorspace_fragment>
        }`,
    });
    this.material.premultipliedAlpha = true;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.resize();
    // upload the texture and compile now, not on the first frame it shows (no hitch)
    this.renderer.initTexture(noise);
    this.renderer.compile(this.scene, this.camera);
    this.ready = true;
    this.set(this.state);
  }

  /** Scroll state: `cover` thickens the bank, `part` slides it apart. */
  set({ cover = this.state.cover, part = this.state.part }) {
    this.state = { cover, part };
    if (!this.ready) return;
    this.material.uniforms.uCover.value = cover;
    this.material.uniforms.uPart.value = part;
    const visible = cover > 0.001 && part < 0.999;
    if (visible === this.active) return;
    this.active = visible;
    this.container.classList.toggle('is-active', visible);
    this.renderer.setAnimationLoop(visible ? this.loop : null);
  }

  loop(now) {
    this.material.uniforms.uTime.value = now / 1000;
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.material) this.material.uniforms.uAspect.value = w / h;
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** The noise volume from a web worker; on the main thread if workers aren't available. */
async function generateNoise() {
  try {
    const worker = new Worker(new URL('./cloud-noise.worker.js', import.meta.url), { type: 'module' });
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => (worker.terminate(), resolve(data));
      worker.onerror = (e) => (worker.terminate(), reject(e));
      worker.postMessage(NOISE_SIZE);
    });
  } catch {
    return cloudNoiseData(NOISE_SIZE);
  }
}
