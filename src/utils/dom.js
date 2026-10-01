import { MOBILE_QUERY, REDUCED_MOTION_QUERY } from '../config.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;
export const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** True when the browser can create a WebGL context (`webgl2Only` for WebGL 2). */
export function supportsWebGL({ webgl2Only = false } = {}) {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || (!webgl2Only && c.getContext('webgl')));
  } catch {
    return false;
  }
}
