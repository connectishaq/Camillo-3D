import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { palette } from './palette.js';

/**
 * Daytime Melbourne light: a Three.js `Sky` shader (used for reflections), a matching sun,
 * hemisphere fill, and a horizon/fog colour equal to the page background (`--map-sky`), so
 * the canvas edges blend into the page. Colours come from the design tokens.
 * Axes: x = east, y = up, z = south. The sun sits in the north-west (southern hemisphere).
 */
export const SUN = { elevation: 34, azimuth: 305 }; // degrees; azimuth clockwise from north

/** Horizon / fog / background colour (`--map-sky`). */
export const horizonColor = () => new THREE.Color(palette().sky);

export function sunDirection({ elevation, azimuth } = SUN) {
  const el = THREE.MathUtils.degToRad(elevation);
  const az = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export function createSky(options = SUN) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4.5;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  u.cloudCoverage.value = 0.22;
  u.cloudDensity.value = 0.32;
  u.cloudElevation.value = 0.55;
  u.sunPosition.value.copy(sunDirection(options));
  sky.frustumCulled = false;
  return sky;
}

export function createLights(options = SUN) {
  // The sky PMREM carries raw HDR radiance, so scenes use a low environmentIntensity
  // (~0.16) and let the sun dominate; otherwise shadows are washed out.
  const p = palette();
  const sun = new THREE.DirectionalLight(p.sun, 2.9);
  sun.position.copy(sunDirection(options)).multiplyScalar(1000);
  const hemi = new THREE.HemisphereLight(p.skyLight, p.groundLight, 0.75);
  return { sun, hemi };
}

/** Environment map baked from the sky (sun disc hidden to avoid a hot spot). */
export function skyEnvironment(renderer, sky) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const clone = new Sky();
  clone.material.uniforms = THREE.UniformsUtils.clone(sky.material.uniforms);
  clone.material.uniforms.showSunDisc.value = 0;
  clone.scale.setScalar(100);
  envScene.add(clone);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 400);
  clone.geometry.dispose();
  clone.material.dispose();
  pmrem.dispose();
  return rt.texture;
}
