import * as THREE from 'three';
import { COLORS, FLOOR_H } from '../../../config.js';

export const BRASS = new THREE.Color(COLORS.brass);
export const BRASS_HOT = new THREE.Color(COLORS.brassHot);

/*
 * Our own overlay shapes for the photoreal city. Nothing here is traced from the
 * Google tiles: rings, beams and ghosts are generated from `site.js` only.
 * Built-in materials are used throughout so the logarithmic depth buffer works.
 */

let ringTex;
let beamTex;

/** Soft brass halo: a thin bright band fading out on both sides. */
function ringTexture() {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.86, 'rgba(255,255,255,1)');
  grad.addColorStop(0.93, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  ringTex = new THREE.CanvasTexture(c);
  return ringTex;
}

/** Vertical fade for the light beam (uv.v = 0 at the base). alphaMap reads the green channel. */
function beamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.25, '#8c8c8c');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

const glow = (params) =>
  new THREE.MeshBasicMaterial({
    color: BRASS,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    ...params,
  });

/**
 * Marker for one site: ground ring + pulse ring + light beam, and optionally a
 * wireframe "ghost" of the floor stack for projects still being built.
 */
export function createSiteMarker({ radius, model = null, ghost = false, beamHeight = 220 }) {
  const group = new THREE.Group();
  group.renderOrder = 2;

  const ringGeo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = glow({ map: ringTexture(), opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 1.2;
  group.add(ring);

  const pulseMat = glow({ map: ringTexture(), opacity: 0 });
  const pulse = new THREE.Mesh(ringGeo, pulseMat);
  pulse.position.y = 1.4;
  group.add(pulse);

  const beamGeo = new THREE.CylinderGeometry(1.1, 1.6, beamHeight, 12, 1, true);
  beamGeo.translate(0, beamHeight / 2, 0);
  // normal (not additive) blending: additive washes out to white over daylight imagery
  const beamMat = glow({ alphaMap: beamTexture(), opacity: 0.35, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  group.add(beam);

  const mats = { ring: ringMat, pulse: pulseMat, beam: beamMat };

  if (ghost && model) {
    const lineMat = new THREE.LineBasicMaterial({
      color: BRASS,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const fillMat = glow({ opacity: 0.07, side: THREE.DoubleSide });
    const stack = new THREE.Group();
    model.floors.forEach((f, i) => {
      const sb = f.setback || 0;
      const w = model.width - sb * 2;
      const d = model.depth - sb * 2;
      const box = new THREE.BoxGeometry(w, FLOOR_H - 0.3, d);
      box.translate(0, i * FLOOR_H + FLOOR_H / 2, 0);
      stack.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), lineMat));
      stack.add(new THREE.Mesh(box, fillMat));
    });
    group.add(stack);
    Object.assign(mats, { ghostLine: lineMat, ghostFill: fillMat });
  }

  return { group, ring, pulse, beam, mats };
}

/** Tween a marker between idle and active. */
export function setMarkerActive(marker, on, gsap, idle = { ring: 0.45, beam: 0.28 }, active = { ring: 0.95, beam: 0.75 }) {
  const { mats } = marker;
  const color = on ? BRASS_HOT : BRASS;
  Object.values(mats).forEach((m) => gsap.to(m.color, { r: color.r, g: color.g, b: color.b, duration: 0.8 }));
  gsap.to(mats.ring, { opacity: on ? active.ring : idle.ring, duration: 0.8 });
  gsap.to(mats.beam, { opacity: on ? active.beam : idle.beam, duration: 0.8 });
  if (mats.ghostLine) gsap.to(mats.ghostLine, { opacity: on ? 0.95 : 0.45, duration: 0.8 });
  if (mats.ghostFill) gsap.to(mats.ghostFill, { opacity: on ? 0.14 : 0.06, duration: 0.8 });
  marker.active = on;
}

export function disposeMarker(marker) {
  marker.group.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose?.();
  });
  marker.group.removeFromParent();
}
