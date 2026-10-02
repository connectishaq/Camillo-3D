import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { createSky, createLights, skyEnvironment, sunDirection, horizonColor } from '../../gfx/sky.js';
import { createWorldUVMaterial } from '../../gfx/facade.js';
import { groundTexture } from '../../gfx/proctex.js';
import { buildMask, parks, racecourses } from './city/land.js';
import { buildLayout } from './city/layout.js';
import { buildRoads } from './city/roads.js';
import { CityBuildings, createCityMaterials } from './city/buildings.js';
import { CityTrees, createTreeAssets } from './city/trees.js';
import { buildWater, ellipseGeo } from './city/water.js';
import { Neighbourhoods, DETAIL_RADIUS } from './city/detail.js';
import { ProjectModels, siteClearings } from './city/projects.js';
import { SUBURBS, toXZ } from './geo.js';
import { chapterCamera, zoomToDistance, sideOffset, buildingFraming } from './camera.js';
import { createPin } from '../../components/pin/pin.js';
import { isMobile, nextFrame } from '../../utils/dom.js';
import { lerp } from '../../utils/math.js';
import { PROJECT_FRAMING } from '../../config.js';

const FOV = 40;

/**
 * Built-in, fully generated daytime Melbourne (no map tiles, no network).
 * Same interface as MapStory / PhotorealStory: `go(chapter)` flies the camera.
 *
 * World generation (land-use raster → street network → buildings, trees, water,
 * close-up neighbourhoods, project models) runs in steps behind the loader.
 */
export class CityStory {
  constructor(container, { cameras, office, projects, reducedMotion = false, onReady, onPinClick, onProgress }) {
    this.container = container;
    this.cameras = cameras;
    this.office = office;
    this.projects = projects;
    this.reducedMotion = reducedMotion;
    this.onPinClick = onPinClick;
    this.onProgress = onProgress;
    this.orbit = false;
    this.paused = false;
    this.pins = new Map();
    this.labels = [];
    // y: height the camera aims at (m); offsetY: vertical screen shift (px, mobile close-ups)
    this.cam = { x: 0, y: 0, z: 0, dist: 6000, pitch: 55, bearing: -20, offsetX: 0, offsetY: 0 };
    this.mobile = isMobile();

    this.initScene();
    if (import.meta.env.DEV) window.__city = this; // debugging handle (dev only)
    const hero = this.cameraFor('hero');
    Object.assign(this.cam, hero, { dist: hero.dist * 2.2 });
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.loop = this.loop.bind(this);
    this.build()
      .catch((err) => {
        console.warn('[city] world generation failed:', err);
      })
      .finally(() => {
        this.renderer.setAnimationLoop(this.loop);
        requestAnimationFrame(() => onReady?.());
      });
  }

  /* ---------------- setup ---------------- */

  initScene() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = !this.mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.debug.checkShaderErrors = import.meta.env.DEV; // faster compiles; no driver-warning noise in production
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizon = horizonColor();
    scene.background = horizon;
    scene.fog = new THREE.Fog(horizon, 4000, 26000);

    const sky = createSky();
    sky.material.uniforms.showSunDisc.value = 0; // keep the glow, avoid a bloom flare during the hero orbit
    scene.add(sky);
    scene.environment = skyEnvironment(renderer, sky);
    scene.environmentIntensity = 0.16;

    const { sun, hemi } = createLights();
    sun.castShadow = !this.mobile;
    sun.shadow.mapSize.set(2048, 2048);
    // bias is in normalised shadow depth (range = far − near); keep it tiny and let the
    // world-space normalBias handle acne, or low houses lose their shadows entirely
    sun.shadow.bias = -0.00003;
    sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 2.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 6500;
    scene.add(sun, sun.target, hemi);
    this.sunDir = sunDirection();

    const camera = new THREE.PerspectiveCamera(FOV, 1, 5, 90000);
    Object.assign(this, { renderer, scene, camera, sky, sun, hemi });
    this.initPost();
  }

  /** Light touch: GTAO + very mild bloom + SMAA on desktop; FXAA only on mobile. */
  initPost() {
    const { renderer, scene, camera } = this;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (!this.mobile) {
      const ao = new GTAOPass(scene, camera, 512, 512);
      ao.blendIntensity = 0.55;
      ao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.2, thickness: 4, scale: 1, samples: 10 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
      composer.addPass(ao);
      this.ao = ao;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.1, 0.35, 0.96);
      composer.addPass(this.bloom);
    }
    composer.addPass(new OutputPass());
    if (this.mobile) {
      this.fxaa = new ShaderPass(FXAAShader);
      composer.addPass(this.fxaa);
    } else composer.addPass(new SMAAPass());
    this.composer = composer;
  }

  async build() {
    const progress = (p) => this.onProgress?.(p);
    const steps = [];
    const step = (weight, fn) => steps.push([weight, fn]);
    let layout;
    let trees;
    const clear = siteClearings(this.projects, this.office);
    const sites = [toXZ(this.office.coords), ...this.projects.map((p) => toXZ(p.coords))];
    const detailAreas = sites.map(([x, z]) => [x, z, DETAIL_RADIUS]);
    const nearRadius = this.mobile ? 1500 : 2200;

    step(0.15, () => buildMask());
    step(0.1, () => {
      layout = buildLayout({ keepClear: clear });
      this.layout = layout;
    });
    step(0.1, () => {
      this.buildGround();
      const water = buildWater();
      this.water = water;
      this.scene.add(water.group, buildRoads(layout));
    });
    step(0.25, () => {
      this.mats = createCityMaterials();
      this.buildings = new CityBuildings(layout, this.mats, { detail: detailAreas, clear, nearRadius });
      this.scene.add(this.buildings.group);
    });
    step(0.15, () => {
      trees = new CityTrees(layout, createTreeAssets(), {
        skip: (x, z) =>
          clear.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r) ||
          detailAreas.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r),
        nearRadius,
      });
      this.trees = trees;
      this.scene.add(trees.group);
    });
    step(0.15, () => {
      this.hoods = new Neighbourhoods(layout, this.mats, trees, sites, { clear, extrasRadius: this.mobile ? 2000 : 3200 });
      this.scene.add(this.hoods.group);
    });
    step(0.1, () => {
      this.models = new ProjectModels(this.projects, this.office, [...layout.roads.minor, ...layout.roads.major]);
      this.scene.add(this.models.group);
      this.buildOverlays();
      if (this.current) {
        // re-frame: a project chapter can only be framed on its building once the models exist
        const current = this.current;
        this.current = null;
        this.go(current, { duration: 0.01 });
      }
    });

    let done = 0;
    const timings = [];
    for (const [w, fn] of steps) {
      const t = performance.now();
      fn();
      timings.push(Math.round(performance.now() - t));
      done += w;
      progress(Math.min(0.98, done));
      await nextFrame();
    }
    if (import.meta.env.DEV) console.debug('[city] generated in', timings.join(' + '), 'ms');
    // warm up: compile shaders and build the first near-LOD set before the reveal
    this.applyCamera();
    this.updateLOD(true);
    this.renderer.compile(this.scene, this.camera);
    progress(1);
  }

  buildGround() {
    const off = (f) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
    const land = new THREE.Mesh(new THREE.PlaneGeometry(90000, 90000), createWorldUVMaterial('land', { scale: 140, roughness: 1 }));
    land.rotation.x = -Math.PI / 2;
    land.receiveShadow = true;
    this.scene.add(land);

    const lawn = createWorldUVMaterial('lawn', { scale: 22, roughness: 1, ...off(-1) });
    parks.forEach((e) => {
      const m = new THREE.Mesh(ellipseGeo(e), lawn);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      m.receiveShadow = true;
      this.scene.add(m);
    });
    // racecourses: infield lawn + a dirt/turf track ring with a white rail
    const track = new THREE.MeshStandardMaterial({ map: groundTexture('track'), roughness: 1, ...off(-2) });
    const rail = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.6, ...off(-3) });
    racecourses.forEach((e) => {
      const infield = new THREE.Mesh(ellipseGeo(e), lawn);
      infield.rotation.x = -Math.PI / 2;
      infield.position.y = 0.02;
      this.scene.add(infield);
      [
        [1, 0.86, track],
        [0.865, 0.855, rail],
        [1.005, 0.995, rail],
      ].forEach(([outer, inner, mat]) => {
        const g = ringGeo(e, outer, inner);
        const m = new THREE.Mesh(g, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.03;
        m.receiveShadow = true;
        this.scene.add(m);
      });
    });
  }

  buildOverlays() {
    const layer = document.createElement('div');
    layer.className = 'city-overlay';
    this.container.appendChild(layer);
    this.overlay = layer;

    SUBURBS.forEach(([name, ll]) => {
      const el = document.createElement('span');
      el.className = name === 'Port Phillip Bay' ? 'city-label city-label--water' : 'city-label city-label--photo';
      el.textContent = name;
      layer.appendChild(el);
      const [x, z] = toXZ(ll);
      this.labels.push({ el, pos: new THREE.Vector3(x, 40, z) });
    });

    const pin = (key, label, hq, onClick) => {
      const el = createPin({ label, hq, onClick });
      layer.appendChild(el);
      const s = this.models.sites.get(key);
      this.pins.set(key, { el, pos: new THREE.Vector3(s.x, s.height + 8, s.z) });
    };
    pin('office', 'Camillo HQ', true, () => this.go('office'));
    this.projects.forEach((p) => pin(p.slug, p.name, false, () => this.onPinClick?.(p)));
  }

  /* ---------------- camera ---------------- */

  /**
   * Orbit params for a chapter. Project chapters are framed from the building itself (its
   * size and street front, see camera.js buildingFraming), so it fills the screen; the other
   * chapters convert their map-style camera (center/zoom/pitch/bearing).
   */
  cameraFor(chapter) {
    const c = chapterCamera(chapter, this);
    if (!c) return null;
    const [x, z] = toXZ(c.center);
    const viewport = {
      width: this.container.clientWidth || window.innerWidth,
      height: this.container.clientHeight || window.innerHeight,
      fov: FOV,
    };
    const slug = chapter.startsWith('project:') && chapter.split(':')[1];
    const site = slug && this.models?.sites.get(slug);
    if (site) {
      const { model } = this.projects.find((p) => p.slug === slug);
      const f = buildingFraming({ width: model.width, depth: model.depth, height: site.height }, site.site.rotation.y, viewport);
      const bearing = this.clearestBearing(slug, site, model, f);
      return { x: site.x, z: site.z, y: f.lookY, dist: f.dist, pitch: f.pitch, bearing, offsetY: f.offsetY };
    }
    const dist = zoomToDistance(c.center, c.zoom, viewport.height, FOV);
    return { x, z, y: 0, dist, pitch: c.pitch, bearing: c.bearing, offsetY: 0 };
  }

  /**
   * Of a few viewing angles around the street front, the one where the fewest city buildings
   * stand between the camera and the project (raycast once per project, then cached).
   */
  clearestBearing(slug, site, model, framing) {
    this.bearings ??= new Map();
    if (this.bearings.has(slug)) return this.bearings.get(slug);
    const front = framing.bearing - PROJECT_FRAMING.angle;
    const a = PROJECT_FRAMING.angle;
    const candidates = [a, -a, a + 26, -a - 26, a + 52, -a - 52].map((d) => front + d);
    const blockers = [this.buildings?.group, this.hoods?.group].filter(Boolean);
    const ray = (this.raycaster ??= new THREE.Raycaster());
    const p = (framing.pitch * Math.PI) / 180;
    const clearance = Math.max(model.width, model.depth) * 0.55; // ignore hits at the building itself
    const aims = [0.15, 0.5, 0.9].map((k) => new THREE.Vector3(site.x, site.height * k, site.z));
    const cam = new THREE.Vector3();
    const dir = new THREE.Vector3();
    let best = candidates[0];
    let bestBlocked = Infinity;
    for (const bearing of candidates) {
      const b = (bearing * Math.PI) / 180;
      const d = framing.dist;
      cam.set(site.x - Math.sin(b) * d * Math.sin(p), framing.lookY + d * Math.cos(p) + 2, site.z + Math.cos(b) * d * Math.sin(p));
      let blocked = 0;
      for (const aim of aims) {
        dir.subVectors(aim, cam);
        const len = dir.length();
        ray.set(cam, dir.normalize());
        ray.far = Math.max(1, len - clearance);
        if (ray.intersectObjects(blockers, true).length) blocked++;
      }
      if (blocked < bestBlocked) {
        best = bearing;
        bestBlocked = blocked;
        if (!blocked) break;
      }
    }
    this.bearings.set(slug, best);
    return best;
  }

  offsetFor(chapter) {
    return sideOffset(chapter, this.container.clientWidth);
  }

  go(chapter, { duration } = {}) {
    if (this.current === chapter) return;
    const target = this.cameraFor(chapter);
    if (!target) return;
    this.current = chapter;
    this.orbit = chapter === 'hero' && !this.reducedMotion;
    this.highlight(chapter);

    const from = { ...this.cam };
    const travel = Math.hypot(target.x - from.x, target.z - from.z);
    const arc = Math.max(0, travel * 0.55 - (from.dist + target.dist) / 2);
    const db = ((((target.bearing - from.bearing) % 360) + 540) % 360) - 180; // shortest turn
    const offsetX = this.offsetFor(chapter);
    const state = { t: 0 };
    this.tween?.kill();
    this.tween = gsap.to(state, {
      t: 1,
      duration: duration ?? Math.min(3.4, 1.6 + travel / 9000),
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = state.t;
        this.cam.x = lerp(from.x, target.x, t);
        this.cam.z = lerp(from.z, target.z, t);
        this.cam.y = lerp(from.y, target.y, t);
        this.cam.offsetY = lerp(from.offsetY, target.offsetY, t);
        this.cam.dist = Math.exp(lerp(Math.log(from.dist), Math.log(target.dist), t)) + Math.sin(Math.PI * t) * arc;
        this.cam.pitch = lerp(from.pitch, target.pitch, t);
        this.cam.bearing = from.bearing + db * t;
        this.cam.offsetX = lerp(from.offsetX, offsetX, t);
      },
    });
  }

  highlight(chapter) {
    const slug = chapter.startsWith('project:') ? chapter.split(':')[1] : chapter === 'office' || chapter === 'contact' ? 'office' : null;
    this.pins.forEach(({ el }, key) => {
      el.classList.toggle('is-active', key === slug);
      el.style.opacity = !slug || key === slug ? '1' : '0.35';
    });
    this.models?.highlight(slug);
  }

  applyCamera() {
    const { x, z, pitch, bearing } = this.cam;
    const dist = this.cam.dist;
    const p = (pitch * Math.PI) / 180;
    const b = (bearing * Math.PI) / 180;
    const cam = this.camera;
    const y = this.cam.y;
    cam.position.set(x - Math.sin(b) * dist * Math.sin(p), y + dist * Math.cos(p) + 2, z + Math.cos(b) * dist * Math.sin(p));
    cam.lookAt(x, y, z);
    const alt = Math.max(20, cam.position.y);
    cam.near = Math.max(1.5, alt * 0.012);
    cam.far = Math.max(40000, alt * 40);
    const { w, h } = this.size || {};
    if (w) cam.setViewOffset(w, h, this.cam.offsetX, this.cam.offsetY, w, h);
    else cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.size = { w, h };
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.ao?.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2)); // AO at half resolution
    this.bloom?.setSize(Math.round(w / 2), Math.round(h / 2));
    this.fxaa?.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.last = undefined;
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    this.tween?.kill();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay?.remove();
  }

  /* ---------------- frame ---------------- */

  updateLOD(force = false) {
    if (!this.buildings) return;
    const alt = this.camera.position.y;
    const n = force ? 12 : 1;
    for (let i = 0; i < n; i++) {
      this.buildings.update(this.cam.x, this.cam.z, alt);
      this.trees.update(this.cam.x, this.cam.z, alt, this.camera.position.x, this.camera.position.z);
    }
    this.hoods.update(this.cam.x, this.cam.z);
  }

  /** Sun shadows cover the area around the camera target: crisp up close, cheap from afar. */
  updateShadows() {
    if (!this.sun.castShadow) return;
    const e = THREE.MathUtils.clamp(this.cam.dist * 0.75, 220, 2600);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - e) / e > 0.04) {
      sc.left = sc.bottom = -e;
      sc.right = sc.top = e;
      sc.updateProjectionMatrix();
    }
    // snap the target to shadow texels so moving the camera doesn't make edges crawl
    const texel = (2 * e) / this.sun.shadow.mapSize.x;
    const tx = Math.round(this.cam.x / texel) * texel;
    const tz = Math.round(this.cam.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx, 0, tz).addScaledVector(this.sunDir, 3200);
    this.sun.target.updateMatrixWorld();
  }

  loop(time) {
    if (this.paused) return;
    const dt = this.last === undefined ? 0.016 : Math.min(0.1, (time - this.last) / 1000);
    this.last = time;
    if (this.orbit && !this.tween?.isActive()) this.cam.bearing += 1.8 * dt;

    // fog scales with altitude so wide shots stay legible and close-ups stay crisp
    this.scene.fog.near = this.cam.dist * 1.5 + 1200;
    this.scene.fog.far = this.cam.dist * 8 + 14000;

    this.applyCamera();
    this.sky.position.copy(this.camera.position);
    this.updateLOD();
    this.updateShadows();
    if (this.water) this.water.material.userData.uniforms.uTime.value = time / 1000;
    this.models?.animate(time);
    if (this.ao) this.ao.enabled = this.cam.dist < 3500;

    // fully hidden (e.g. behind the Featured Projects clouds): keep the camera and LOD up to
    // date so it's ready when revealed, but skip the expensive draw
    // (but always draw the first few frames, so every post-processing shader is compiled
    // behind the loader rather than on the first frame the visitor scrolls into)
    if (this.occluded && this.drawn > 3) return;
    this.composer.render();
    this.drawn = (this.drawn || 0) + 1;
    this.placeOverlays();
  }

  /** Skip drawing while something opaque covers the whole map (the clouds). */
  setOccluded(on) {
    this.occluded = on;
  }

  placeOverlays() {
    const { w, h } = this.size || {};
    if (!w) return;
    const v = new THREE.Vector3();
    const place = (el, pos, maxDist, anchor) => {
      v.copy(pos).project(this.camera);
      const d = this.camera.position.distanceTo(pos);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 && d < maxDist;
      el.hidden = !visible;
      if (visible) el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) ${anchor}`;
    };
    const far = this.cam.dist;
    this.labels.forEach(({ el, pos }) => {
      place(el, pos, Math.max(9000, far * 2.2), 'translate(-50%, -50%)');
      el.style.opacity = far < 2500 ? '0' : far > 14000 ? '0.55' : '0.85';
    });
    this.pins.forEach(({ el, pos }) => place(el, pos, 90000, 'translate(-9px, -50%)'));
  }
}

/* ---------------- helpers ---------------- */

function ringGeo([cx, cz, rx, rz, rot], outer, inner) {
  const pt = (a, k) => {
    const u = Math.cos(a) * rx * k;
    const v = Math.sin(a) * rz * k;
    return [cx + u * Math.cos(rot) - v * Math.sin(rot), -(cz + u * Math.sin(rot) + v * Math.cos(rot))];
  };
  const s = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const [ox, oy] = pt(a, outer);
    const [ix, iy] = pt(-a, inner);
    i ? s.lineTo(ox, oy) : s.moveTo(ox, oy);
    i ? hole.lineTo(ix, iy) : hole.moveTo(ix, iy);
  }
  s.holes.push(hole);
  return new THREE.ShapeGeometry(s);
}
