import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/**
 * Warm late-afternoon Melbourne sky (Three.js `Sky` shader) with a matching sun,
 * hemisphere fill, horizon-tinted fog colour and a PMREM environment for reflections.
 * Axes: x = east, y = up, z = south. The sun sits in the north-west (southern hemisphere).
 */
export const SUN = { elevation: 24, azimuth: 305 }; // degrees; azimuth clockwise from north
export const HORIZON = new THREE.Color('#e3d3bf');

/** Horizon / fog colour (a fresh copy). */
export const horizonColor = () => HORIZON.clone();

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
  // Blend the sky into the distance-haze colour towards the horizon, so the far edge of the
  // city (which fades to HORIZON in the fog) meets the sky softly instead of in a hard line.
  u.uHorizon = { value: HORIZON.clone() };
  sky.material.fragmentShader = sky.material.fragmentShader.replace('void main() {', 'uniform vec3 uHorizon;\nvoid main() {').replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    `float horizonFade = 1.0 - smoothstep( 0.0, 0.18, direction.y );
      gl_FragColor = vec4( mix( texColor, uHorizon, horizonFade ), 1.0 );`,
  );
  sky.frustumCulled = false;
  return sky;
}

export function createLights(options = SUN) {
  // The sky PMREM carries raw HDR radiance, so scenes use a low environmentIntensity
  // (~0.16) and let the sun dominate; otherwise shadows are washed out.
  const sun = new THREE.DirectionalLight('#ffe2b8', 6.0);
  sun.position.copy(sunDirection(options)).multiplyScalar(1000);
  const hemi = new THREE.HemisphereLight('#dfe5ea', '#8f8068', 0.75);
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
