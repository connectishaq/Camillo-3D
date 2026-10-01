import * as THREE from 'three';
import gsap from 'gsap';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { GLTFExtensionsPlugin, TileCompressionPlugin, UpdateOnChangePlugin, TilesFadePlugin } from '3d-tiles-renderer/three/plugins';
import { modelHeight } from '../../../data/models/index.js';
import { SUBURBS } from '../geo.js';
import { createLocalFrame, GroundSampler } from './frame.js';
import { createSiteMarker, setMarkerActive, disposeMarker } from '../city/markers.js';
import { Attribution } from './attribution.js';
import { chapterCamera, zoomToDistance, sideOffset } from '../camera.js';
import { createPin } from '../../../components/pin/pin.js';
import { isMobile, supportsWebGL } from '../../../utils/dom.js';
import { lerp } from '../../../utils/math.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const ORIGIN = [144.9631, -37.8136]; // Melbourne CBD: origin of the local ENU frame
const FOV = 40;
const D2R = Math.PI / 180;
const HAZE = new THREE.Color('#c3cfd9');
// Late-afternoon sun from the north-west (southern hemisphere)
const SUN = { elevation: 38, azimuth: 318 };

/**
 * Photorealistic 3D Melbourne from Google Photorealistic 3D Tiles (Map Tiles API),
 * rendered with 3d-tiles-renderer on our own Three.js scene.
 * Same interface as MapStory / CityStory: `go(chapter)` flies the camera.
 *
 * The tileset is transformed into a local East-North-Up frame at the CBD, so the
 * scene is in metres with x = east, y = up, z = south (as in CityStory).
 */
export class PhotorealStory {
  constructor(container, { cameras, office, projects, reducedMotion = false, onReady, onFail, onPinClick, onProgress }) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    this.cameras = cameras;
    this.office = office;
    this.projects = projects;
    this.onReady = onReady;
    this.onFail = onFail;
    this.onPinClick = onPinClick;
    this.onProgress = onProgress;
    this.orbit = false;
    this.paused = false;
    this.ready = false;
    this.pins = new Map();
    this.labels = [];
    this.sites = [];
    this.groundCache = new Map();
    this.progress = 0;
    this.loadedModels = 0;
    this.tileErrors = 0;
    this.lift = 0;
    this.liftTarget = 0;
    this.nextSample = 0;
    this.nextSite = 0;
    this.nextCredits = 0;
    this.siteCursor = 0;
    this.cam = { x: 0, y: 0, z: 0, dist: 3000, pitch: 55, bearing: -20, offsetX: 0 };
    this.lookAt = new THREE.Vector3();
    this.mobile = isMobile();

    if (!API_KEY) return this.fail('no-key');
    if (!supportsWebGL({ webgl2Only: true })) return this.fail('webgl');

    try {
      this.frame = createLocalFrame(ORIGIN);
      this.initScene();
      this.initTiles();
      this.buildSites();
      this.buildOverlays();
    } catch (err) {
      console.warn('[photoreal]', err);
      return this.fail('init');
    }

    this.attribution = new Attribution();
    document.body.classList.add('is-photoreal');

    // Preload the first chapter's final view while the loader is up.
    Object.assign(this.cam, this.cameraFor('hero'));
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.failTimer = setTimeout(() => !this.rootLoaded && this.fail('timeout'), 15000);
    this.loop = this.loop.bind(this);
    this.renderer.setAnimationLoop(this.loop);
  }

  /* ---------------- setup ---------------- */

  initScene() {
    const renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Only the sky is tone mapped; tiles and overlays opt out (toneMapped: false).
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.55;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = HAZE.clone();
    scene.fog = new THREE.Fog(HAZE, 6000, 40000);

    const sky = new Sky();
    sky.scale.setScalar(1000);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 1.1;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    u.cloudCoverage.value = 0.28;
    u.cloudDensity.value = 0.35;
    const phi = (90 - SUN.elevation) * D2R;
    const theta = SUN.azimuth * D2R;
    // azimuth clockwise from north (-z), in our east/up/south frame
    u.sunPosition.value.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), -Math.sin(phi) * Math.cos(theta));
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 5, 200000);
    Object.assign(this, { renderer, scene, camera, sky });
  }

  initTiles() {
    const tiles = new TilesRenderer();
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: API_KEY, autoRefreshToken: true }));
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 300 }));

    // Registered after the Google plugin, which applies its own errorTarget on init.
    tiles.errorTarget = this.mobile ? 24 : 14;
    const cache = tiles.lruCache;
    cache.minBytesSize = (this.mobile ? 0.15 : 0.35) * 2 ** 30;
    cache.maxBytesSize = (this.mobile ? 0.25 : 0.55) * 2 ** 30;
    if (this.mobile) {
      cache.minSize = 2500;
      cache.maxSize = 3500;
    }

    // ECEF → local ENU (x east, y up, z south)
    this.frame.matrix.decompose(tiles.group.position, tiles.group.quaternion, tiles.group.scale);
    tiles.group.updateMatrixWorld(true);

    tiles.addEventListener('load-root-tileset', () => {
      this.rootLoaded = true;
      this.rootAt = performance.now();
      clearTimeout(this.failTimer);
    });
    tiles.addEventListener('load-model', ({ scene }) => {
      this.loadedModels++;
      scene.traverse((o) => {
        if (o.material) o.material.toneMapped = false;
      });
    });
    tiles.addEventListener('load-error', ({ tile, error }) => {
      if (!tile) {
        console.warn('[photoreal] root tileset failed:', error?.message || error);
        this.fail('root');
        return;
      }
      if (++this.tileErrors > 12 && !this.ready) this.fail('tiles');
    });

    tiles.setCamera(this.camera);
    this.scene.add(tiles.group);
    this.tiles = tiles;
    this.sampler = new GroundSampler(tiles.group);
  }

  /** Brass ring + light beam at the HQ and each project; ghosts for sites under construction. */
  buildSites() {
    const add = (key, coords, opts) => {
      const p = this.frame.toLocal(coords);
      const marker = createSiteMarker(opts);
      marker.group.position.set(p.x, p.y + 12, p.z);
      this.scene.add(marker.group);
      this.sites.push({ key, x: p.x, z: p.z, ground: null, radius: opts.radius, marker, pinHeight: opts.pinHeight });
    };
    add('office', this.office.coords, { radius: 30, pinHeight: 38 });
    this.projects.forEach((p) => {
      const m = p.model;
      add(p.slug, p.coords, {
        radius: Math.max(m.width, m.depth) * 0.75 + 12,
        model: m,
        ghost: /under construction/i.test(p.status),
        pinHeight: modelHeight(m) + 12,
      });
    });
  }

  buildOverlays() {
    const layer = document.createElement('div');
    layer.className = 'city-overlay';
    this.container.appendChild(layer);
    this.overlay = layer;

    SUBURBS.forEach(([name, ll]) => {
      if (name === 'Port Phillip Bay') return; // the real bay speaks for itself
      const el = document.createElement('span');
      el.className = 'city-label city-label--photo';
      el.textContent = name;
      layer.appendChild(el);
      this.labels.push({ el, pos: this.frame.toLocal(ll, 60) });
    });

    const pin = (key, label, hq, onClick) => {
      const el = createPin({ label, hq, onClick });
      layer.appendChild(el);
      const site = this.sites.find((s) => s.key === key);
      this.pins.set(key, { el, site, pos: new THREE.Vector3() });
    };
    pin('office', 'Camillo HQ', true, () => this.go('office'));
    this.projects.forEach((p) => pin(p.slug, p.name, false, () => this.onPinClick?.(p)));
  }

  /* ---------------- camera ---------------- */

  /** Map-style camera (center/zoom/pitch/bearing) → orbit params. Same zoom→distance as CityStory. */
  cameraFor(chapter) {
    const c = chapterCamera(chapter, this);
    if (!c) return null;
    const p = this.frame.toLocal(c.center);
    const dist = zoomToDistance(c.center, c.zoom, this.container.clientHeight || window.innerHeight, FOV);
    const cached = this.groundCache.get(chapter);
    return { x: p.x, z: p.z, y: cached ?? p.y + 10, dist, pitch: c.pitch, bearing: c.bearing, key: chapter };
  }

  offsetFor(chapter) {
    return sideOffset(chapter, this.container.clientWidth);
  }

  go(chapter, { duration } = {}) {
    if (this.current === chapter || this.failed || !this.frame) return;
    const target = this.cameraFor(chapter);
    if (!target) return;
    this.current = chapter;
    if (!this.ready) {
      // Still loading: jump there so this is the view that preloads.
      Object.assign(this.cam, target, { offsetX: this.offsetFor(chapter) });
      return;
    }
    this.flyTo(target, duration);
  }

  flyTo(target, duration) {
    const chapter = target.key;
    this.orbit = chapter === 'hero' && !this.reducedMotion;
    this.highlight(chapter);
    const sampled = this.sampler.groundAt(target.x, target.z);
    if (sampled !== null) target.y = sampled;
    this.flight = target;

    const from = { ...this.cam };
    const travel = Math.hypot(target.x - from.x, target.z - from.z);
    // flyTo-style arc: rise mid-flight on long hops so tiles stream in from above
    const arc = Math.max(0, travel * 0.55 - (from.dist + target.dist) / 2);
    const db = ((((target.bearing - from.bearing) % 360) + 540) % 360) - 180; // shortest turn
    const offsetX = this.offsetFor(chapter);
    const state = { t: 0 };
    this.tween?.kill();
    this.tween = gsap.to(state, {
      t: 1,
      duration: duration ?? Math.min(4, 1.8 + travel / 8000),
      ease: 'power2.inOut',
      onUpdate: () => {
        const t = state.t;
        const c = this.cam;
        c.x = lerp(from.x, target.x, t);
        c.z = lerp(from.z, target.z, t);
        c.y = lerp(from.y, target.y, t); // target.y keeps refining as tiles load
        c.dist = Math.exp(lerp(Math.log(from.dist), Math.log(target.dist), t)) + Math.sin(Math.PI * t) * arc;
        c.pitch = lerp(from.pitch, target.pitch, t);
        c.bearing = from.bearing + db * t;
        c.offsetX = lerp(from.offsetX, offsetX, t);
      },
      onComplete: () => (this.flight = null),
    });
  }

  highlight(chapter) {
    const slug = chapter.startsWith('project:') ? chapter.split(':')[1] : chapter === 'office' || chapter === 'contact' ? 'office' : null;
    this.pins.forEach(({ el }, key) => {
      el.classList.toggle('is-active', key === slug);
      el.style.opacity = !slug || key === slug ? '1' : '0.35';
    });
    this.sites.forEach(({ key, marker }) => {
      const on = key === slug;
      if (marker.active !== on) setMarkerActive(marker, on, gsap);
    });
  }

  applyCamera() {
    const { x, y, z, dist, pitch, bearing } = this.cam;
    const p = pitch * D2R;
    const b = bearing * D2R;
    const cam = this.camera;
    cam.position.set(x - Math.sin(b) * dist * Math.sin(p), y + dist * Math.cos(p) + this.lift, z + Math.cos(b) * dist * Math.sin(p));
    this.lookAt.set(x, y, z);
    cam.lookAt(this.lookAt);

    // Depth range follows altitude: tight near plane up close, far horizon when high.
    const alt = Math.max(30, cam.position.y - y);
    cam.near = Math.max(2, alt * 0.02);
    cam.far = Math.max(60000, alt * 90);
    const { w, h } = this.size || {};
    if (w) cam.setViewOffset(w, h, this.cam.offsetX, 0, w, h);
    else cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    this.sky.position.copy(cam.position);
    this.scene.fog.near = dist * 1.4 + 1500;
    this.scene.fog.far = dist * 8 + 15000;
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.size = { w, h };
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.last = undefined;
  }

  /* ---------------- loading ---------------- */

  fail(reason) {
    if (this.failed || this.ready) return;
    this.failed = true;
    clearTimeout(this.failTimer);
    // async so the caller has finished constructing us before it tears us down
    setTimeout(() => this.onFail?.(reason), 0);
  }

  trackLoading(time) {
    if (this.ready || this.failed) return;
    const { stats } = this.tiles;
    const pending = stats.queued + stats.downloading + stats.parsing;
    const frac = this.rootLoaded ? 0.1 + 0.85 * (this.loadedModels / Math.max(1, this.loadedModels + pending)) : 0.05;
    if (frac > this.progress) {
      this.progress = Math.min(0.95, frac);
      this.onProgress?.(this.progress);
    }

    if (!this.rootLoaded) return;
    const settled = pending === 0 && this.tiles.visibleTiles.size > 0 && this.loadedModels > 0;
    if (!settled) this.settledAt = undefined;
    else this.settledAt ??= time;
    const stable = this.settledAt !== undefined && time - this.settledAt > 600;
    if (stable || performance.now() - this.rootAt > 9000) this.becomeReady();
  }

  becomeReady() {
    this.ready = true;
    this.onProgress?.(1);
    this.onReady?.();
    this.footerCredit(true);
    // intro: start pulled back, then fly into the current chapter
    const chapter = this.current || 'hero';
    const target = this.cameraFor(chapter);
    this.cam.dist *= 1.7;
    this.flyTo(target, 3.5);
  }

  footerCredit(on) {
    const el = document.querySelector('.footer__credit');
    if (!el) return;
    if (on) {
      this.prevCredit ??= el.textContent;
      el.textContent = '3D city: Google Photorealistic 3D Tiles · Map data ©Google';
    } else if (this.prevCredit !== undefined) el.textContent = this.prevCredit;
  }

  /** Keeps ground heights, marker heights and camera clearance in step with the tiles. */
  sampleGround(time) {
    if (time < this.nextSample) return;
    this.nextSample = time + 250;

    const t = this.flight;
    if (t) {
      const g = this.sampler.groundAt(t.x, t.z);
      if (g !== null) {
        t.y = g;
        this.groundCache.set(t.key, g);
      }
    } else if (this.ready) {
      const g = this.sampler.groundAt(this.cam.x, this.cam.z);
      if (g !== null) {
        this.groundTarget = g;
        if (this.current) this.groundCache.set(this.current, g);
      }
    }

    // never clip into terrain or towers under the camera
    const cp = this.camera.position;
    const peak = this.sampler.peakAt(cp.x, cp.z);
    this.liftTarget = peak === null ? 0 : Math.max(0, peak + 35 - (cp.y - this.lift));

    // one site per tick, round robin
    const site = this.sites[this.siteCursor++ % this.sites.length];
    const sg = this.sampler.groundAt(site.x, site.z, site.radius * 0.9);
    if (sg !== null) site.ground = sg;
  }

  /* ---------------- frame ---------------- */

  loop(time) {
    if (this.paused || this.stopped) return;
    const dt = this.last === undefined ? 0.016 : Math.min(0.1, (time - this.last) / 1000);
    this.last = time;

    if (this.ready && this.orbit && !this.tween?.isActive()) this.cam.bearing += 1.8 * dt;
    if (!this.flight && this.groundTarget !== undefined) this.cam.y += (this.groundTarget - this.cam.y) * Math.min(1, dt * 2);
    this.lift += (this.liftTarget - this.lift) * Math.min(1, dt * 3);

    this.applyCamera();
    this.tiles.update();
    this.trackLoading(time);
    if (this.tiles.root) this.sampleGround(time);
    this.animateSites(time, dt);

    this.renderer.render(this.scene, this.camera);
    this.placeOverlays();

    if (time > this.nextCredits) {
      this.nextCredits = time + 500;
      this.attribution?.update(this.tiles);
    }
  }

  animateSites(time, dt) {
    this.sites.forEach((s) => {
      const g = s.marker.group;
      if (s.ground !== null) g.position.y += (s.ground - g.position.y) * Math.min(1, dt * 4);
      if (s.marker.active) {
        const k = (time * 0.0005) % 1;
        s.marker.pulse.scale.setScalar(1 + k * 0.9);
        s.marker.mats.pulse.opacity = (1 - k) * 0.7;
      } else s.marker.mats.pulse.opacity = 0;
    });
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
    const showLabels = far > 2600;
    this.labels.forEach(({ el, pos }) => {
      if (!showLabels) return (el.hidden = true);
      place(el, pos, Math.max(9000, far * 2.2), 'translate(-50%, -50%)');
    });
    this.pins.forEach(({ el, site, pos }) => {
      pos.set(site.x, site.marker.group.position.y + site.pinHeight, site.z);
      place(el, pos, 90000, 'translate(-9px, -50%)');
    });
  }

  destroy() {
    this.stopped = true;
    clearTimeout(this.failTimer);
    this.tween?.kill();
    this.ro?.disconnect();
    this.renderer?.setAnimationLoop(null);
    this.sites.forEach(({ marker }) => disposeMarker(marker));
    try {
      this.tiles?.dispose();
    } catch {
      /* partially initialised */
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.overlay?.remove();
    this.attribution?.destroy();
    this.footerCredit(false);
    document.body.classList.remove('is-photoreal');
  }
}
