import * as THREE from 'three';
import { facadeTexture, FACADE_KINDS, groundTexture } from './proctex.js';

/*
 * Material patches that map textures in world space, so one unit-box InstancedMesh
 * can carry buildings of any size without stretched windows.
 */

/**
 * Façade material for instanced unit boxes (base at y = 0). Windows come from a
 * procedural data texture (see proctex.facadeTexture) laid out at real bay width and
 * floor height; wall colour comes from the instance colour; roofs get `roof` colour.
 */
export function createFacadeMaterial(kind, { bay = 3.2, floor = 3.3, glass = '#5b7384', roof = '#8d8c88', lit = '#ffcf8a', litStrength = 0.9, glassRough = 0.12, glassMetal = 0.72, roughness = 0.85 } = {}) {
  const tex = facadeTexture(kind);
  const { bays, floors } = FACADE_KINDS[kind];
  const mat = new THREE.MeshStandardMaterial({ roughness, metalness: 0.02 });
  const uniforms = {
    uFacade: { value: tex },
    uTile: { value: new THREE.Vector2(bays * bay, floors * floor) },
    uGlass: { value: new THREE.Color(glass) },
    uRoof: { value: new THREE.Color(roof) },
    uLit: { value: new THREE.Color(lit).multiplyScalar(litStrength) },
    uGlassRough: { value: glassRough },
    uGlassMetal: { value: glassMetal },
  };
  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => `facade-${kind}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFacWorld; varying vec3 vFacN; varying float vFacBase; varying float vFacSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        mat4 facM = modelMatrix;
        #ifdef USE_INSTANCING
          facM = modelMatrix * instanceMatrix;
        #endif
        vFacWorld = (facM * vec4(transformed, 1.0)).xyz;
        vFacN = normalize(mat3(facM) * objectNormal);
        vec4 facO = facM * vec4(0.0, 0.0, 0.0, 1.0);
        vFacBase = facO.y;
        vFacSeed = fract(sin(dot(facO.xz, vec2(12.9898, 78.233))) * 43758.5453);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uFacade; uniform vec2 uTile; uniform vec3 uGlass; uniform vec3 uRoof; uniform vec3 uLit;
        uniform float uGlassRough; uniform float uGlassMetal;
        varying vec3 vFacWorld; varying vec3 vFacN; varying float vFacBase; varying float vFacSeed;`,
      )
      .replace(
        '#include <color_fragment>',
        `vec3 facBase = diffuseColor.rgb;
        #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
          facBase *= vColor.rgb;
        #endif
        vec3 facN = normalize(vFacN);
        float facRoof = step(0.6, facN.y);
        vec2 facT = normalize(vec2(-facN.z, facN.x) + 1e-5);
        vec2 facUv = facRoof > 0.5
          ? vFacWorld.xz / uTile.x
          : vec2(dot(vFacWorld.xz, facT) / uTile.x + vFacSeed, (vFacWorld.y - vFacBase) / uTile.y);
        vec3 facD = texture2D(uFacade, facUv).rgb;
        float facWin = facRoof > 0.5 ? 0.0 : facD.g;
        float facLit = facD.b * facWin * step(0.55, fract(vFacSeed * 7.13 + floor(facUv.y) * 0.37));
        vec3 facWall = facBase * (0.78 + 0.44 * facD.r);
        vec3 facGlass = uGlass * (0.7 + 0.6 * facD.r);
        vec3 facRoofC = uRoof * (0.85 + 0.3 * facD.r);
        diffuseColor.rgb = facRoof > 0.5 ? facRoofC : mix(facWall, facGlass, facWin);`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, uGlassRough, facWin);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, uGlassMetal, facWin);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uLit * facLit;`);
  };
  return mat;
}

/**
 * Standard material whose `map` is sampled from world XZ (for ground layers, roofs,
 * lawns). `scale` = metres per texture tile.
 */
export function createWorldUVMaterial(textureKind, { scale = 40, color = '#ffffff', roughness = 0.95, metalness = 0, texture = null, ...rest } = {}) {
  const map = texture || groundTexture(textureKind);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, map, ...rest });
  mat.customProgramCacheKey = () => `worlduv-${textureKind}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWuvScale = { value: 1 / scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWuvScale;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          mat4 wm = modelMatrix;
          #ifdef USE_INSTANCING
            wm = modelMatrix * instanceMatrix;
          #endif
          vec3 wp = (wm * vec4(position, 1.0)).xyz;
          vMapUv = wp.xz * uWuvScale;
        }`,
      );
  };
  return mat;
}
