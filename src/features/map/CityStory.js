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
import { ProjectModels, siteClearings, HQ_MODEL } from './city/projects.js';
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
    this.still = 0; // seconds the camera has been still
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
      .finally(async () => {
        this.renderer.setAnimationLoop(this.loop);
        await this.precompile(); // behind the loader
        requestAnimationFrame(() => onReady?.());
        this.prebuild();
      });
  }

  /* ---------------- setup ---------------- */

  initScene() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // render resolution: starts at maxRatio, stepped down on devices that can't keep up (adapt)
    this.maxRatio = Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5);
    this.minRatio = Math.min(this.maxRatio, this.mobile ? 0.75 : 0.85);
    renderer.setPixelRatio(this.maxRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = !this.mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // redrawn only when it changes (updateShadows)
    renderer.shadowMap.needsUpdate = true;
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
      ao.blendIntensity = 0; // faded in once the camera settles (loop)
      ao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.2, thickness: 4, scale: 1, samples: 10 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
      composer.addPass(ao);
      this.ao = ao;
      this.aoMix = 0;
      this.aoAllowed = true;
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
   * Orbit params for a chapter. Project chapters and the HQ (About) are framed from the
   * building itself (its size and street front, see camera.js buildingFraming), so it fills
   * the screen; the other chapters convert their map-style camera (center/zoom/pitch/bearing).
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
    const slug = chapter === 'office' ? 'office' : chapter.startsWith('project:') && chapter.split(':')[1];
    const site = slug && this.models?.sites.get(slug);
    if (site) {
      const model = slug === 'office' ? HQ_MODEL : this.projects.find((p) => p.slug === slug).model;
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
    this.destroyed = true;
    this.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    this.tween?.kill();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay?.remove();
  }

  /**
   * Close-up houses and street trees are built when the camera first comes near them, which
   * would stall a flight mid-scroll. Build them for every chapter's destination ahead of time
   * instead, one superblock at a time while the browser is idle.
   */
  prebuild() {
    if (!this.buildings) return;
    const chapters = [...Object.keys(this.cameras), ...this.projects.map((p) => `project:${p.slug}`)];
    const spots = chapters.map((c) => this.cameraFor(c)).filter((c) => c && c.dist < 6000);
    const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
    const step = (deadline) => {
      if (this.destroyed) return;
      while (spots.length && deadline.timeRemaining() > 4) {
        const { x, z } = spots[0];
        if (!this.buildings.prebuild(x, z) && !this.trees.prebuild(x, z)) spots.shift();
      }
      if (spots.length) idle(step, { timeout: 1000 });
      else this.precompile();
    };
    idle(step, { timeout: 1000 });
  }

  /**
   * Compiles the shader of every material in the city, close-ups included, without blocking;
   * otherwise the first view of a new area (the skyline) stalls for a moment while they compile.
   * Compiled for the composer's buffer, the target they're really drawn into.
   */
  precompile() {
    const renderer = this.renderer;
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(this.composer.readBuffer);
    const done = renderer.compileAsync(this.scene, this.camera).catch(() => {});
    renderer.setRenderTarget(target);
    return done;
  }

  /* ---------------- frame ---------------- */

  updateLOD(force = false) {
    if (!this.buildings) return;
    const alt = this.camera.position.y;
    const n = force ? 12 : 1;
    // building new close-ups takes a few ms each: never mid-flight (prebuild covers the stops)
    const build = force || !this.tween?.isActive();
    for (let i = 0; i < n; i++) {
      this.buildings.update(this.cam.x, this.cam.z, alt, build);
      this.trees.update(this.cam.x, this.cam.z, alt, this.camera.position.x, this.camera.position.z, build);
    }
    this.hoods.update(this.cam.x, this.cam.z);
  }

  /** Seconds the camera has been still (0 on any frame it moves). */
  updateMotion(dt) {
    const c = this.cam;
    const key = [c.x, c.y, c.z, c.dist, c.pitch, c.bearing, c.offsetX, c.offsetY];
    const same = this.lastCam && key.every((v, i) => v === this.lastCam[i]);
    this.still = same ? this.still + dt : 0;
    this.lastCam = key;
  }

  /**
   * Sun shadows cover the area around the camera target: crisp up close, cheap from afar.
   * The shadow map is a second full draw of the city, so it's only redrawn when it changes:
   * its area steps in coarse jumps (so it moves a few times per flight, not every frame), plus
   * every few frames while flying (new close-up buildings) and once when the camera stops.
   */
  updateShadows() {
    if (!this.sun.castShadow) return;
    const shadow = this.renderer.shadowMap;
    // extent in 10% steps, a little larger than needed so the coarse target steps stay covered
    const want = THREE.MathUtils.clamp(this.cam.dist * 0.82, 240, 2900);
    const e = 240 * Math.pow(1.1, Math.ceil(Math.log(want / 240) / Math.log(1.1)));
    const sc = this.sun.shadow.camera;
    if (sc.right !== e) {
      sc.left = sc.bottom = -e;
      sc.right = sc.top = e;
      sc.updateProjectionMatrix();
      shadow.needsUpdate = true;
    }
    // snap the target to a whole number of shadow texels so edges don't crawl as it moves
    const step = ((2 * e) / this.sun.shadow.mapSize.x) * 64;
    const tx = Math.round(this.cam.x / step) * step;
    const tz = Math.round(this.cam.z / step) * step;
    if (tx !== this.sun.target.position.x || tz !== this.sun.target.position.z) {
      this.sun.target.position.set(tx, 0, tz);
      this.sun.position.set(tx, 0, tz).addScaledVector(this.sunDir, 3200);
      this.sun.target.updateMatrixWorld();
      shadow.needsUpdate = true;
    }
    if (this.still === 0) {
      this.shadowSettled = false;
      if (this.frame % 6 === 0) shadow.needsUpdate = true;
    } else if (!this.shadowSettled) {
      this.shadowSettled = true;
      shadow.needsUpdate = true;
    }
  }

  /** Ambient occlusion (another full draw of the city) only while the camera rests; it fades in. */
  updateAO(dt) {
    if (!this.ao) return;
    const want = this.aoAllowed && this.cam.dist < 3500 && this.still > 0.2;
    this.aoMix = THREE.MathUtils.clamp(this.aoMix + (want ? 2.5 : -5) * dt, 0, 1);
    // (always on, invisibly, for the first frames behind the loader, so its shaders are
    // compiled then rather than the first time the camera settles)
    this.ao.enabled = this.aoMix > 0 || !(this.drawn > 3);
    this.ao.blendIntensity = 0.55 * this.aoMix * this.aoMix * (3 - 2 * this.aoMix);
  }

  /**
   * Keeps the flights smooth on slower devices: while the camera moves, average the frame time
   * and step the render resolution down when it can't keep up (and back up with headroom).
   * At the lowest resolution, ambient occlusion and bloom go too.
   */
  adapt(ms) {
    if (this.still > 0 || this.occluded || ms > 250) return; // only judge real, visible motion
    const q = (this.quality ||= { sum: 0, n: 0, good: 0 });
    q.sum += ms;
    if (++q.n < 45) return;
    const avg = q.sum / q.n;
    q.sum = q.n = 0;
    const pr = this.renderer.getPixelRatio();
    if (avg > 22) {
      q.good = 0;
      if (pr > this.minRatio) this.setRatio(Math.max(this.minRatio, pr - 0.25));
      else {
        this.aoAllowed = false;
        if (this.bloom) this.bloom.enabled = false;
      }
    } else if (avg < 17.5 && pr < this.maxRatio) {
      if (++q.good >= 4) {
        q.good = 0;
        this.setRatio(Math.min(this.maxRatio, pr + 0.125));
      }
    } else q.good = 0;
  }

  setRatio(pr) {
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  loop(time) {
    if (this.paused) return;
    const ms = this.last === undefined ? 16 : time - this.last;
    const dt = Math.min(0.1, ms / 1000);
    this.last = time;
    this.frame = (this.frame || 0) + 1;
    if (this.orbit && !this.tween?.isActive()) this.cam.bearing += 1.8 * dt;

    // fog scales with altitude so wide shots stay legible and close-ups stay crisp
    this.scene.fog.near = this.cam.dist * 1.5 + 1200;
    this.scene.fog.far = this.cam.dist * 8 + 14000;

    this.applyCamera();
    this.updateMotion(dt);
    this.adapt(ms);
    this.sky.position.copy(this.camera.position);
    this.updateLOD();
    this.updateShadows();
    if (this.water) this.water.material.userData.uniforms.uTime.value = time / 1000;
    this.models?.animate(time);
    this.updateAO(dt);

    // fully hidden (e.g. behind the Featured Projects clouds): keep the camera and LOD up to
    // date so it's ready when revealed, but skip the expensive draw
    // (but always draw the first few frames, so every post-processing shader is compiled
    // behind the loader rather than on the first frame the visitor scrolls into)
    if (this.occluded && this.drawn > 3) return;
    // at rest only the water and the marker pulse change: half the frame rate is plenty
    if (this.still > 1 && !(this.aoMix > 0 && this.aoMix < 1) && this.frame % 2) return;
    this.composer.render();
    this.drawn = (this.drawn || 0) + 1;
    this.placeOverlays();
  }

  /** Skip drawing while something opaque covers the whole map (the hero). */
  setOccluded(on) {
    this.occluded = on;
  }

  placeOverlays() {
    const { w, h } = this.size || {};
    if (!w) return;
    // only touch the DOM when something changed (each write costs a style pass every frame)
    const v = (this._v ||= new THREE.Vector3());
    const set = (item, key, value, apply) => {
      if (item[key] === value) return;
      item[key] = value;
      apply(value);
    };
    const place = (item, maxDist, anchor) => {
      const { el, pos } = item;
      v.copy(pos).project(this.camera);
      const d = this.camera.position.distanceTo(pos);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 && d < maxDist;
      set(item, '_hidden', !visible, (on) => (el.hidden = on));
      if (!visible) return false;
      const x = Math.round(((v.x + 1) / 2) * w * 2) / 2; // half-pixel steps
      const y = Math.round(((1 - v.y) / 2) * h * 2) / 2;
      set(item, '_at', `${x},${y}`, () => (el.style.transform = `translate(${x}px, ${y}px) ${anchor}`));
      return true;
    };
    const far = this.cam.dist;
    const labelOpacity = far < 2500 ? '0' : far > 14000 ? '0.55' : '0.85';
    this.labels.forEach((item) => {
      set(item, '_opacity', labelOpacity, (o) => (item.el.style.opacity = o));
      if (labelOpacity === '0') return set(item, '_hidden', true, (on) => (item.el.hidden = on));
      place(item, Math.max(9000, far * 2.2), 'translate(-50%, -50%)');
    });
    this.pins.forEach((item) => place(item, 90000, 'translate(-9px, -50%)'));
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
