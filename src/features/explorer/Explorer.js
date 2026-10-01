import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import gsap from 'gsap';
import './explorer.css';
import { buildBuilding, buildContext, HIT_LAYER } from './building.js';
import { buildInterior, disposeInterior } from './interior.js';
import { createInteriorMaterials, createContextMaterials } from './materials.js';
import { metricPlaneUV } from './textures.js';
import { buildGLBBuilding, loadedGLB } from './glb.js';
import { createSky, skyEnvironment, horizonColor, sunDirection } from '../../gfx/sky.js';
import { palette } from '../../gfx/palette.js';
import { BREAKPOINT } from '../../config.js';
import { isMobile } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/escape.js';
import { trapFocus } from '../../utils/focus-trap.js';

const EXPLODE_GAP = 2.6;
const LIFT = 34;
// Presentation light: sun from the front-left so the street façade (+Z) is lit, as in the
// project photography (the city uses the real north-west afternoon sun instead).
const EX_SUN = { elevation: 36, azimuth: 212 };

const PROGRAM_LABEL = {
  lobby: (n) => (n ? `Lobby · ${n} residences` : 'Entrance lobby'),
  apartments: (n) => `${n} residence${n > 1 ? 's' : ''}`,
  penthouse: (n) => `Penthouse level · ${n}`,
  'whole-floor': () => 'Whole-floor residence',
  rumpus: () => 'Rumpus · sport · wellness',
  living: () => 'Living · dining · pool',
  bedrooms: () => 'Bedrooms & ensuite',
};

/**
 * Full-screen Three.js building explorer.
 *  - hover a level → outline + tooltip
 *  - click a level → upper floors lift away and the interior is built in place
 *  - "Step inside" → first-person camera at eye level
 *
 * modal (default): a full-screen dialog that traps focus and closes on Esc.
 * modal: false: embedded in the page (project pages); Esc only steps back out of a floor.
 */
export class Explorer {
  constructor(root, { modal = true, onOpen, onClose } = {}) {
    this.root = root;
    this.modal = modal;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.$ = (sel) => root.querySelector(sel);
    this.state = { hover: -1, focused: null, exploded: false, inside: false };
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(HIT_LAYER);
    this.mobile = isMobile();
    this.bindUI();
  }

  /* ---------------- lifecycle ---------------- */

  initRenderer() {
    if (this.renderer) return;
    const host = this.$('[data-explorer-canvas]');
    const renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps the light page colour exact (see CityStory)
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // + shadow.radius for soft edges
    renderer.localClippingEnabled = true; // GLB models are split into levels by clipping planes
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    host.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    host.appendChild(labels.domElement);

    // light studio look: the page background behind the model, the procedural sky for reflections only
    const scene = new THREE.Scene();
    const p = palette();
    scene.background = horizonColor();
    const sky = createSky(EX_SUN);
    sky.material.uniforms.showSunDisc.value = 0;
    sky.visible = false;
    scene.add(sky);
    scene.environment = skyEnvironment(renderer, sky);
    scene.environmentIntensity = 0.18;
    scene.fog = new THREE.Fog(horizonColor(), 260, 700);
    this.sky = sky;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 1200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.49;

    const hemi = new THREE.HemisphereLight(p.skyLight, p.groundLight, 0.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(p.sun, 3.2);
    sun.castShadow = true;
    const shadowRes = this.mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);

    const ctx = createContextMaterials();
    const ground = new THREE.Mesh(metricPlaneUV(new THREE.CircleGeometry(400, 64), 800, 800), ctx.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    Object.assign(this, { renderer, labels, scene, camera, controls, sun, hemi, host });
    this.interiorMats = createInteriorMaterials();
    this.initPost();

    new ResizeObserver(() => this.resize()).observe(host);
    renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
    renderer.domElement.addEventListener('pointerdown', (e) => (this.downAt = [e.clientX, e.clientY]));
    renderer.domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
    renderer.domElement.addEventListener('pointerleave', () => this.setHover(-1));
  }

  /** Subtle GTAO + bloom. On mobile: bloom only, at reduced resolution. */
  initPost() {
    const { renderer, scene, camera } = this;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (!this.mobile) {
      const ao = new GTAOPass(scene, camera, 512, 512);
      ao.blendIntensity = 0.75;
      ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 1.2, scale: 1, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(ao);
      this.ao = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.08, 0.35, 1.6);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  open(project) {
    this.initRenderer();
    this.project = project;
    this.state = { hover: -1, focused: null, exploded: false, inside: false };
    if (this.ao) this.ao.enabled = true;
    this.buildScene(project.model);
    this.fillPanel(project);

    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.resize();
    this.resume();
    this.introCamera();
    if (this.modal) {
      clearTimeout(this.closeTimer);
      document.body.classList.add('is-locked');
      this.releaseFocus ??= trapFocus(this.root);
      this.$('[data-explorer-close]').focus({ preventScroll: true });
    }
    this.onOpen?.();
  }

  close() {
    if (!this.modal || !this.isOpen) return;
    this.root.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    this.releaseFocus?.();
    this.releaseFocus = null;
    this.closeTimer = setTimeout(() => {
      this.root.hidden = true;
      this.pause();
      this.teardown();
    }, 500);
    this.onClose?.();
  }

  /** Stop / restart rendering (e.g. while an embedded explorer is scrolled out of view). */
  pause() {
    this.renderer?.setAnimationLoop(null);
  }

  resume() {
    this.renderer?.setAnimationLoop(() => this.render());
  }

  get isOpen() {
    return !this.root.hidden && this.root.classList.contains('is-open');
  }

  /* ---------------- scene ---------------- */

  buildScene(model) {
    this.teardown();
    // Path A (GLB from public/models) when available, else the parametric model (Path B)
    const glb = loadedGLB(model.slug);
    const b = glb ? buildGLBBuilding(model, glb) : buildBuilding(model);
    const ctx = buildContext(b.size, model.width * 7 + model.depth);
    this.scene.add(b.root, ctx);
    this.building = b;
    this.context = ctx;

    const R = Math.max(b.size.w, b.size.d);
    const toSun = sunDirection(EX_SUN);
    this.sun.position.copy(toSun).multiplyScalar(R * 2 + b.size.h * 2 + 40);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -R * 2;
    sc.right = sc.top = R * 2;
    sc.far = b.size.h * 4 + 200;
    sc.updateProjectionMatrix();
  }

  teardown() {
    if (!this.building) return;
    this.building.floors.forEach((f) => f.interior && disposeInterior(f.interior));
    [this.building.root, this.context].forEach((g) => {
      g.traverse((o) => {
        if (!o.geometry?.userData.shared) o.geometry?.dispose(); // GLB clones share the cached source's geometry
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        list.forEach((m) => !m.userData?.shared && m.dispose());
      });
      g.removeFromParent();
    });
    this.building = null;
  }

  homeView() {
    const { w, d, h } = this.building.size;
    const R = Math.max(w, d, h * 0.8);
    const extra = this.state.exploded ? this.building.floors.length * EXPLODE_GAP : 0;
    const H = h + extra;
    return {
      position: new THREE.Vector3(R * 1.05, H * 0.6 + R * 0.45, R * 1.3),
      target: new THREE.Vector3(0, H * 0.42, 0),
    };
  }

  introCamera() {
    const v = this.homeView();
    this.camera.position.copy(v.position).multiplyScalar(1.6);
    this.controls.target.copy(v.target);
    this.flyTo(v, 1.8);
  }

  flyTo({ position, target }, duration = 1.2) {
    gsap.to(this.camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power3.inOut' });
    gsap.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut' });
  }

  resize() {
    if (!this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    // bloom is soft by nature: render it at reduced resolution (more so on mobile)
    const k = this.mobile ? 0.35 : 0.5;
    this.bloom.setSize(Math.round(w * k), Math.round(h * k));
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    // shift framing right on desktop so the panel doesn't cover the model
    const offset = w > BREAKPOINT ? -Math.min(190, w * 0.14) : 0;
    this.camera.setViewOffset(w, h, offset, h > w ? h * 0.12 : 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.controls.update();
    this.sky.position.copy(this.camera.position);
    this.building?.floors.forEach((f) => f.clip?.());
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  /* ---------------- floors ---------------- */

  floorY(f) {
    const s = this.state;
    let y = f.baseY + (s.exploded ? f.index * EXPLODE_GAP : 0);
    if (s.focused !== null && f.index > s.focused) y += LIFT + (f.index - s.focused) * 3;
    return y;
  }

  layoutFloors(duration = 0.9) {
    this.building.floors.forEach((f) => {
      gsap.to(f.group.position, { y: this.floorY(f), duration, ease: 'power3.inOut' });
    });
  }

  fade(f, factor, duration = 0.5, onComplete) {
    Object.values(f.mats).forEach((m) =>
      gsap.to(m, { opacity: m.userData.baseOpacity * factor, duration, ease: 'power2.out', overwrite: true }),
    );
    if (onComplete) gsap.delayedCall(duration, onComplete);
  }

  setHover(i) {
    if (!this.building || this.state.focused !== null) return;
    if (i === this.state.hover) return;
    this.state.hover = i;
    const tooltip = this.$('[data-ex-tooltip]');
    this.building.floors.forEach((f) => {
      const on = f.index === i;
      gsap.to(f.edges.material, { opacity: on ? 1 : 0, duration: 0.25 });
      this.fade(f, i === -1 || on ? 1 : 0.35, 0.3);
    });
    this.root.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('is-hover', +b.dataset.floor === i));
    this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
    if (i < 0) tooltip.hidden = true;
    else {
      const f = this.building.floors[i];
      tooltip.textContent = `${f.data.label} · ${this.programLabel(f.data)}`;
      tooltip.hidden = false;
    }
  }

  focusFloor(i) {
    const floors = this.building.floors;
    const f = floors[i];
    this.setHover(-1);
    this.state.focused = i;
    // the faded façade still writes depth, which would cast phantom AO over the plan
    if (this.ao) this.ao.enabled = false;

    floors.forEach((o) => {
      gsap.to(o.edges.material, { opacity: o.index === i ? 0.6 : 0, duration: 0.3 });
      if (o.index > i) this.fade(o, 0, 0.6, () => (o.group.visible = false));
      else if (o.index < i) this.fade(o, 0.25, 0.6);
    });
    // open up the façade of the selected level
    Object.entries(f.mats).forEach(([key, m]) => {
      const target = key === 'slab' || key === 'soffit' ? 1 : key === 'glass' || key === 'balustrade' ? 0.12 : 0.18;
      gsap.to(m, { opacity: m.userData.baseOpacity * target, duration: 0.6, overwrite: true });
    });
    this.layoutFloors(1.1);

    // build interior in place
    if (!f.interior) {
      f.interior = buildInterior(f, this.interiorMats);
      f.group.add(f.interior.group);
    }
    f.interior.group.visible = true;
    gsap.fromTo(
      f.interior.walls.map((w) => w.scale),
      { y: 0.01 },
      { y: 1, duration: 0.9, ease: 'power3.out', stagger: { amount: 0.5, from: 'random' }, delay: 0.35 },
    );
    setTimeout(() => f.interior.labels.forEach((l) => l.element.classList.add('is-visible')), 900);

    // camera: three-quarter plan view of the level
    const y = this.floorY(f) + 1.2;
    const R = Math.max(f.w, f.d);
    this.flyTo({ position: new THREE.Vector3(R * 0.55, y + R * 1.05, R * 0.95), target: new THREE.Vector3(0, y - 0.6, 0) }, 1.4);

    // panel
    this.showView('floor');
    this.$('[data-ex-floor-title]').textContent = f.data.label;
    this.$('[data-ex-floor-sub]').textContent = this.programLabel(f.data);
    this.$('[data-ex-rooms]').innerHTML = f.interior.summary
      .map(([a, b]) => `<li><span>${escapeHtml(a)}</span><span>${escapeHtml(b)}</span></li>`)
      .join('');
    this.$('[data-ex-inside]').textContent = 'Step inside';
  }

  unfocus() {
    const i = this.state.focused;
    if (i === null) return;
    const floors = this.building.floors;
    const f = floors[i];
    if (this.state.inside) this.insideLook(f, false);
    this.state.focused = null;
    this.state.inside = false;
    if (this.ao) this.ao.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 0;

    if (f.interior) {
      disposeInterior(f.interior);
      f.interior = null;
    }
    floors.forEach((o) => {
      o.group.visible = true;
      this.fade(o, 1, 0.6);
      gsap.to(o.edges.material, { opacity: 0, duration: 0.3 });
    });
    this.layoutFloors(1.1);
    this.flyTo(this.homeView(), 1.3);
    this.showView('building');
  }

  toggleInside() {
    const f = this.building.floors[this.state.focused];
    if (!f?.interior) return;
    this.state.inside = !this.state.inside;
    const btn = this.$('[data-ex-inside]');
    if (this.state.inside) {
      const y = this.floorY(f);
      const pos = f.interior.eye.position.clone().add(new THREE.Vector3(0, y, 0));
      const tgt = f.interior.eye.target.clone().add(new THREE.Vector3(0, y, 0));
      this.controls.maxPolarAngle = Math.PI * 0.95;
      this.flyTo({ position: pos, target: tgt }, 1.6);
      btn.textContent = 'Back to floor plan';
      this.insideLook(f, true);
    } else {
      this.insideLook(f, false);
      this.controls.maxPolarAngle = Math.PI * 0.49;
      const y = this.floorY(f) + 1.2;
      const R = Math.max(f.w, f.d);
      this.flyTo({ position: new THREE.Vector3(R * 0.55, y + R * 1.05, R * 0.95), target: new THREE.Vector3(0, y - 0.6, 0) }, 1.4);
      btn.textContent = 'Step inside';
    }
  }

  /** Eye level: hide the level's façade veil (keep a hint of glass) and warm the fill light. */
  insideLook(f, on) {
    Object.entries(f.mats).forEach(([key, m]) => {
      const k = key === 'slab' ? 1 : key === 'glass' ? (on ? 0.1 : 0.12) : on ? 0.04 : 0.18;
      gsap.to(m, { opacity: m.userData.baseOpacity * k, duration: 0.8, overwrite: true });
    });
    const warm = new THREE.Color(on ? palette().windowLit : palette().skyLight);
    gsap.to(this.hemi.color, { r: warm.r, g: warm.g, b: warm.b, duration: 0.8 });
    gsap.to(this.hemi, { intensity: on ? 1.15 : 0.8, duration: 0.8 });
  }

  toggleExplode() {
    if (this.state.focused !== null) this.unfocus();
    this.state.exploded = !this.state.exploded;
    this.$('[data-ex-explode]').setAttribute('aria-pressed', String(this.state.exploded));
    this.layoutFloors(1.2);
    this.flyTo(this.homeView(), 1.2);
  }

  /* ---------------- input ---------------- */

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.building.floors.filter((f) => f.group.visible).map((f) => f.hit),
      false,
    );
    return hits.length ? hits[0].object.userData.floorIndex : -1;
  }

  onPointerMove(e) {
    if (!this.building || this.state.focused !== null) return;
    this.setHover(this.pick(e));
    const tip = this.$('[data-ex-tooltip]');
    const r = this.root.getBoundingClientRect();
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
  }

  onPointerUp(e) {
    if (!this.downAt || !this.building) return;
    const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
    this.downAt = null;
    if (moved > 6 || this.state.focused !== null) return;
    const i = this.pick(e);
    if (i >= 0) this.focusFloor(i);
  }

  /* ---------------- panel ---------------- */

  programLabel(data) {
    return (PROGRAM_LABEL[data.program] || (() => ''))(data.units);
  }

  fillPanel(p) {
    this.$('[data-ex-suburb]').textContent = `${p.suburb} · ${p.type}`;
    this.$('[data-ex-name]').textContent = p.name;
    this.$('[data-ex-status]').textContent = p.status;
    this.$('[data-ex-note]').textContent = p.model.indicative
      ? 'Illustrative massing model. Level count and layouts are indicative only — not construction drawings.'
      : 'Illustrative 3D model. Interior layouts are indicative only.';
    this.$('[data-ex-explode]').setAttribute('aria-pressed', 'false');
    this.$('[data-ex-floors]').innerHTML = p.model.floors
      .map(
        (f, i) =>
          `<li><button type="button" data-floor="${i}"><span>${escapeHtml(f.label)}</span><small>${this.programLabel(f)}</small></button></li>`,
      )
      .join('');
    this.showView('building');
  }

  showView(name) {
    this.root.querySelectorAll('[data-ex-view]').forEach((v) => (v.hidden = v.dataset.exView !== name));
    this.$('[data-ex-tooltip]').hidden = true;
  }

  bindUI() {
    this.$('[data-explorer-close]')?.addEventListener('click', () => this.close());
    this.$('[data-ex-back]').addEventListener('click', () => this.unfocus());
    this.$('[data-ex-inside]').addEventListener('click', () => this.toggleInside());
    this.$('[data-ex-explode]').addEventListener('click', () => this.toggleExplode());
    this.$('[data-ex-reset]').addEventListener('click', () => {
      if (this.state.focused !== null) this.unfocus();
      else this.flyTo(this.homeView(), 1.1);
    });
    const list = this.$('[data-ex-floors]');
    list.addEventListener('mouseover', (e) => {
      const b = e.target.closest('[data-floor]');
      if (b) this.setHover(+b.dataset.floor);
    });
    list.addEventListener('mouseleave', () => this.setHover(-1));
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-floor]');
      if (b) this.focusFloor(+b.dataset.floor);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.isOpen || !this.building) return;
      if (this.state.inside) this.toggleInside();
      else if (this.state.focused !== null) this.unfocus();
      else this.close();
    });
  }
}
