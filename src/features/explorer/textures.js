/**
 * UV helpers: geometry UVs authored in metres, so procedural textures (gfx/proctex.js,
 * `repeat = 1 / tileSize`) keep their real-world scale on any size of box or plane.
 */

/** Kept for API compatibility; procedural textures set their own anisotropy. */
export function setMaxAnisotropy() {}

/** Rescales a BoxGeometry's UVs from 0–1 per face to metres. */
export function metricBoxUV(geometry, w, h, d) {
  const uv = geometry.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each with 1 segment)
  const spans = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  const per = uv.count / 6;
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = spans[Math.floor(i / per)];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Same for a PlaneGeometry / CircleGeometry of the given extent. */
export function metricPlaneUV(geometry, w, d) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  uv.needsUpdate = true;
  return geometry;
}
