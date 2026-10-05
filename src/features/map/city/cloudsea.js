import * as THREE from 'three';
import { rng } from '../../../gfx/noise.js';

/*
 * A sea of cloud lying over the generated city, for the Featured Projects chapter.
 *
 * Volumetric look without ray marching: a stack of horizontal slices between `base` and
 * `top`, drawn in one call, each sampling a tileable 3D cloud-noise volume ("Perlin–Worley",
 * as in game cloudscapes) at its own height. Rounded domes come from the density thinning
 * with height, sunlit rims from a short shadow probe towards the sun, and distance fades into
 * the horizon haze. The slices depth-test against the city, so tall towers rise through it.
 *
 * `setCover(0…1)`: 0 = clear sky (nothing drawn), 1 = a dense bank; in between it thins and
 * breaks up like fog burning off.
 */
const SIZE = 64; // noise volume resolution (tileable)

export function createCloudSea({ base = 30, top = 230, slices = 24, extent = 18000, sun, horizon, colors }) {
  const noise = cloudNoiseVolume();
  const geometry = sliceStack(slices, extent);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uNoise: { value: noise },
      uCover: { value: 0 },
      uTime: { value: 0 },
      uBase: { value: base },
      uTop: { value: top },
      // opacity of one slice at full density; the same total for any slice count (26 is the reference)
      uSliceAlpha: { value: 1 - Math.pow(1 - 0.85, 26 / slices) },
      uSun: { value: sun.clone().normalize() },
      uLight: { value: new THREE.Color(colors.light) },
      uWarm: { value: new THREE.Color(colors.warm) },
      uShade: { value: new THREE.Color(colors.shade) },
      uHorizon: { value: horizon.clone() },
      uFog: { value: new THREE.Vector2(4000, 26000) },
    },
    vertexShader: /* glsl */ `
      attribute float aLayer;
      uniform float uBase;
      uniform float uTop;
      varying vec3 vWorld;
      varying float vLayer;
      void main() {
        vec4 w = modelMatrix * vec4(position.x, mix(uBase, uTop, aLayer), position.z, 1.0);
        vWorld = w.xyz;
        vLayer = aLayer;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp sampler3D;
      uniform sampler3D uNoise;
      uniform float uCover, uTime, uSliceAlpha;
      uniform vec3 uSun, uLight, uWarm, uShade, uHorizon;
      uniform vec2 uFog;
      varying vec3 vWorld;
      varying float vLayer;

      // cloud density at a point: big billows (r), eroded by fine detail (g), thinning upwards
      float density(vec3 p, float h) {
        vec3 wind = vec3(uTime * 6.0, 0.0, uTime * 2.5);
        float big = texture(uNoise, (p + wind * 0.5) * vec3(1.0 / 5200.0, 1.0 / 900.0, 1.0 / 5200.0)).r;
        vec4 n = texture(uNoise, (p + wind) * vec3(1.0 / 1700.0, 1.0 / 520.0, 1.0 / 1700.0));
        n.r = mix(n.r, big, 0.45); // banks and gaps at a larger scale
        float detail = texture(uNoise, (p + wind * 1.6) * vec3(1.0 / 520.0, 1.0 / 160.0, 1.0 / 520.0)).g;
        float cover = uCover * 0.66;
        float shape = n.r - (1.0 - cover);                       // coverage
        shape -= smoothstep(0.05, 1.0, h) * 0.75 * (1.15 - n.r); // domed, billowing tops
        shape *= smoothstep(0.0, 0.18, h);                        // soft, flat-ish base
        shape -= (1.0 - detail) * 0.22 * (1.0 - clamp(shape * 3.0, 0.0, 1.0)); // wispy edges
        return clamp(shape * 2.4, 0.0, 1.0);
      }

      // the same shape without the fine detail: enough to tell how shaded a point is
      float coarse(vec3 p, float h) {
        vec3 wind = vec3(uTime * 6.0, 0.0, uTime * 2.5);
        float big = texture(uNoise, (p + wind * 0.5) * vec3(1.0 / 5200.0, 1.0 / 900.0, 1.0 / 5200.0)).r;
        float n = mix(texture(uNoise, (p + wind) * vec3(1.0 / 1700.0, 1.0 / 520.0, 1.0 / 1700.0)).r, big, 0.45);
        float shape = n - (1.0 - uCover * 0.66);
        shape -= smoothstep(0.05, 1.0, h) * 0.75 * (1.15 - n);
        return clamp(shape * smoothstep(0.0, 0.18, h) * 2.4, 0.0, 1.0);
      }

      void main() {
        float h = vLayer;
        float d = density(vWorld, h);
        if (d < 0.004) discard;
        // light: how much cloud lies between this point and the sun
        float occ = coarse(vWorld + uSun * 60.0, clamp(h + uSun.y * 0.35, 0.0, 1.0)) * 1.4;
        float sun = exp(-occ * 2.6);
        float ambient = mix(0.25, 1.0, smoothstep(0.0, 0.9, h));
        vec3 col = mix(uShade, uLight, clamp(ambient * 0.4 + sun * 0.75, 0.0, 1.0));
        col = mix(col, uWarm, pow(sun, 3.0) * 0.35 * (1.0 - h * 0.5)); // warm sunlit rims
        // distance haze, as the city's fog
        float dist = distance(vWorld, cameraPosition);
        float f = smoothstep(uFog.x, uFog.y, dist);
        col = mix(col, uHorizon, f * 0.85);
        gl_FragColor = vec4(col, d * uSliceAlpha * (1.0 - f * 0.35));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10; // after the city's opaque and transparent surfaces
  mesh.visible = false;

  return {
    mesh,
    /** 0 = clear, 1 = dense bank */
    setCover(v) {
      material.uniforms.uCover.value = v;
      mesh.visible = v > 0.002;
    },
    /** Per frame: drift, follow the camera target (the noise is in world space), match the fog. */
    update(time, target, fog) {
      if (!mesh.visible) return;
      material.uniforms.uTime.value = time;
      mesh.position.set(Math.round(target.x / 500) * 500, 0, Math.round(target.z / 500) * 500);
      if (fog) material.uniforms.uFog.value.set(fog.near, fog.far);
    },
  };
}

/** `slices` horizontal squares, bottom to top (drawn in that order: right for a camera above). */
function sliceStack(slices, extent) {
  const pos = [];
  const layer = [];
  const idx = [];
  const e = extent / 2;
  for (let i = 0; i < slices; i++) {
    const h = i / (slices - 1);
    const o = pos.length / 3;
    pos.push(-e, 0, -e, e, 0, -e, e, 0, e, -e, 0, e);
    layer.push(h, h, h, h);
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLayer', new THREE.Float32BufferAttribute(layer, 1));
  g.setIndex(idx);
  return g;
}

/**
 * Tileable 3D cloud noise, SIZE³ RGBA8:
 *   r = Perlin–Worley (value-noise fBm shaped by inverted Worley): big cauliflower billows
 *   g = Worley fBm at higher frequency: the erosion detail
 */
function cloudNoiseVolume() {
  const N = SIZE;
  const worley = makeWorley();
  const value = makeValueNoise(N);
  const data = new Uint8Array(N * N * N * 4);
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const w = z / N;
        const wf = 0.625 * worley(u, v, w, 4) + 0.25 * worley(u, v, w, 8) + 0.125 * worley(u, v, w, 16);
        const pf = 0.5 * value(u, v, w, 4) + 0.3 * value(u, v, w, 8) + 0.2 * value(u, v, w, 16);
        const pw = remap(pf, wf - 1, 1, 0, 1); // Perlin–Worley
        const detail = 0.625 * worley(u, v, w, 8) + 0.25 * worley(u, v, w, 16) + 0.125 * worley(u, v, w, 32);
        const i = ((z * N + y) * N + x) * 4;
        data[i] = clamp255(pw);
        data[i + 1] = clamp255(detail);
        data[i + 3] = 255;
      }
    }
  }
  // stretch each channel to the full 0–255 range, so coverage thresholds have contrast
  for (const ch of [0, 1]) {
    let lo = 255;
    let hi = 0;
    for (let i = ch; i < data.length; i += 4) {
      lo = Math.min(lo, data[i]);
      hi = Math.max(hi, data[i]);
    }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = ch; i < data.length; i += 4) data[i] = (data[i] - lo) * k;
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGBAFormat;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Inverted, tileable Worley noise: 1 at feature points, 0 far from them. */
function makeWorley() {
  const cache = new Map();
  const points = (cells) => {
    if (cache.has(cells)) return cache.get(cells);
    const r = rng(1117 * cells);
    const p = new Float32Array(cells * cells * cells * 3).map(() => r());
    cache.set(cells, p);
    return p;
  };
  return (u, v, w, cells) => {
    const p = points(cells);
    const fx = u * cells;
    const fy = v * cells;
    const fz = w * cells;
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    const cz = Math.floor(fz);
    let best = 9;
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ix = (cx + dx + cells) % cells;
          const iy = (cy + dy + cells) % cells;
          const iz = (cz + dz + cells) % cells;
          const k = ((iz * cells + iy) * cells + ix) * 3;
          const ex = cx + dx + p[k] - fx;
          const ey = cy + dy + p[k + 1] - fy;
          const ez = cz + dz + p[k + 2] - fz;
          const d = ex * ex + ey * ey + ez * ez;
          if (d < best) best = d;
        }
    return 1 - Math.min(1, Math.sqrt(best));
  };
}

/** Tileable 3D value noise (smooth trilinear lattice). */
function makeValueNoise() {
  const cache = new Map();
  const lattice = (cells) => {
    if (cache.has(cells)) return cache.get(cells);
    const r = rng(7919 * cells);
    const l = new Float32Array(cells * cells * cells).map(() => r());
    cache.set(cells, l);
    return l;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v, w, cells) => {
    const l = lattice(cells);
    const fx = u * cells;
    const fy = v * cells;
    const fz = w * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const z0 = Math.floor(fz);
    const tx = sm(fx - x0);
    const ty = sm(fy - y0);
    const tz = sm(fz - z0);
    const at = (x, y, z) => l[((z % cells) * cells + (y % cells)) * cells + (x % cells)];
    const lerp = (a, b, t) => a + (b - a) * t;
    const c00 = lerp(at(x0, y0, z0), at(x0 + 1, y0, z0), tx);
    const c10 = lerp(at(x0, y0 + 1, z0), at(x0 + 1, y0 + 1, z0), tx);
    const c01 = lerp(at(x0, y0, z0 + 1), at(x0 + 1, y0, z0 + 1), tx);
    const c11 = lerp(at(x0, y0 + 1, z0 + 1), at(x0 + 1, y0 + 1, z0 + 1), tx);
    return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
  };
}
