import * as THREE from 'three';
import { waterNormals } from '../../../gfx/proctex.js';
import { createWorldUVMaterial } from '../../../gfx/facade.js';
import { PIERS, toXZ, pointInPolygon } from '../geo.js';
import { bay, rivers, lakes, coastLine } from './land.js';
import { Instances, GEO } from './instances.js';

/*
 * Water: a standard PBR surface (so it reflects the sky PMREM and catches sun glints)
 * with two procedurally generated normal-map layers scrolling in different directions.
 * No mirror render pass, so it costs one draw call per body of water.
 */
export function createWaterMaterial() {
  const normals = waterNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: '#1d4d61',
    roughness: 0.08,
    metalness: 0.05,
    normalMap: normals,
    normalScale: new THREE.Vector2(0.55, 0.55),
    envMapIntensity: 1.25,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const uniforms = { uTime: { value: 0 } };
  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => 'city-water';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vWaterXZ;')
      .replace(
        '#include <normal_fragment_maps>',
        `vec2 wuv1 = vWaterXZ / 38.0 + vec2(uTime * 0.012, uTime * 0.007);
        vec2 wuv2 = vWaterXZ / 91.0 + vec2(-uTime * 0.006, uTime * 0.011);
        vec3 wn = texture2D(normalMap, wuv1).xyz * 2.0 - 1.0;
        wn += texture2D(normalMap, wuv2).xyz * 2.0 - 1.0;
        wn.xy *= normalScale * 0.5;
        // water lies flat: tangent space = world XZ, mapped into view space
        normal = normalize((viewMatrix * vec4(normalize(vec3(wn.x, wn.z + 1.0, wn.y)), 0.0)).xyz);`,
      );
  };
  return mat;
}

const flat = (geo, mat, y, name) => {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  m.name = name;
  return m;
};

function shapeFrom(poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  return s;
}

/** Strip along a polyline (in the XY plane for a -90° X rotation). */
export function ribbon(line, width, offset = 0) {
  const pos = [];
  const uv = [];
  const idx = [];
  let along = 0;
  line.forEach(([x, z], i) => {
    const [ax, az] = line[Math.max(0, i - 1)];
    const [bx, bz] = line[Math.min(line.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const o1 = offset - width / 2;
    const o2 = offset + width / 2;
    if (i) along += Math.hypot(x - line[i - 1][0], z - line[i - 1][1]);
    pos.push(x + nx * o1, -(z + nz * o1), 0, x + nx * o2, -(z + nz * o2), 0);
    uv.push(along / 20, 0, along / 20, 1);
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the strip faces up after rotation
  if (g.attributes.normal.getZ(0) < 0) {
    g.setIndex(idx.map((_, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]]));
    g.computeVertexNormals();
  }
  return g;
}

function ellipseGeo([cx, cz, rx, rz, rot], scale = 1) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const u = Math.cos(a) * rx * scale;
    const v = Math.sin(a) * rz * scale;
    const x = cx + u * Math.cos(rot) - v * Math.sin(rot);
    const z = cz + u * Math.sin(rot) + v * Math.cos(rot);
    i ? s.lineTo(x, -z) : s.moveTo(x, -z);
  }
  return new THREE.ShapeGeometry(s);
}
export { ellipseGeo };

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const mat = createWaterMaterial();
  group.add(flat(new THREE.ShapeGeometry(shapeFrom(bay)), mat, 0.12, 'bay'));
  rivers.forEach((r) => group.add(flat(ribbon(r.xz, r.width), mat, 0.12, r.name)));
  lakes.forEach((e, i) => group.add(flat(ellipseGeo(e), mat, 0.12, `lake-${i}`)));

  // sand along the shore: a strip offset to the land side of the coastline
  const sand = createWorldUVMaterial('sand', {
    scale: 30,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const [x0, z0] = coastLine[12];
  const [x1, z1] = coastLine[13];
  const nx = -(z1 - z0);
  const nz = x1 - x0;
  const landSide = pointInPolygon([x0 + nx * 0.01, z0 + nz * 0.01], bay) ? 1 : -1;
  // beaches: Port Melbourne → St Kilda → Brighton → Sandringham (coast points 7…24)
  const beach = coastLine.slice(7, 25);
  group.add(flat(ribbon(beach, 55, landSide * 22), sand, 0.06, 'beach'));

  // piers: deck + pylons (+ sheds on Station Pier)
  const deck = new THREE.MeshStandardMaterial({ color: '#b8ab95', roughness: 0.9 });
  const pylons = new Instances();
  const sheds = new Instances();
  PIERS.forEach((p) => {
    const [ax, az] = toXZ(p.from);
    const [bx, bz] = toXZ(p.to);
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(-(bz - az), bx - ax);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, p.width), deck);
    m.position.set((ax + bx) / 2, 2.2, (az + bz) / 2);
    m.rotation.y = rot;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    for (let t = 6; t < len; t += 9) {
      const x = ax + ((bx - ax) * t) / len;
      const z = az + ((bz - az) * t) / len;
      const nx2 = Math.sin(rot);
      const nz2 = Math.cos(rot);
      [-0.4, 0.4].forEach((o) => pylons.push(x + nx2 * o * p.width, -1, z + nz2 * o * p.width, 0.6, 3.2, 0.6, rot, '#6f655a'));
    }
    if (p.sheds) sheds.push(ax * 0.4 + bx * 0.6, 2.5, az * 0.4 + bz * 0.6, len * 0.55, 7, p.width * 0.45, rot, '#e8e2d6');
  });
  const py = pylons.build(GEO.box, deck, { shadows: false });
  if (py) group.add(py);
  const sh = sheds.build(GEO.box, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }));
  if (sh) group.add(sh);

  return { group, material: mat };
}
