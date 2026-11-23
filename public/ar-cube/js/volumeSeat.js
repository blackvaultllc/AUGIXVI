// Volume seat math for the AR Cube takeover staging (v2.5).
//
// Pure and three-free on purpose: app.js feeds it measured bounds, and
// the repo's tests import this exact file to pin the seat rule against
// known model shapes — the numbers the page runs are the numbers the
// tests prove.
//
// THE SEAT RULE. Anchor space: the tracked face is the square
// [-0.5, 0.5]^2 at z = 0, +z out of the face toward the camera, 1 unit
// = one face width. The cube's volume is x in [-0.5, 0.5],
// y in [-0.5, 0.5] (floor at y = -0.5), z in [-1, 0] (the face plane
// is the open front). A model TAKES OVER the cube when, inside that
// volume:
//   - its base sits exactly on the floor (min y = -0.5),
//   - it is centered left-right (center x = 0) and front-back
//     (center z = -0.5),
//   - it is scaled uniformly until its footprint (the larger of its
//     x/z extents) covers FOOTPRINT of the face — but never so large
//     that its height passes HEIGHT_CAP or either horizontal extent
//     passes FOOTPRINT (nothing pokes through the shell walls).
// The returned { scale, position } is the stage transform: a point p
// of the model lands at position + scale * p.
export const VOLUME_SEAT = {
  footprint: 0.92, // of the 1-unit face, on each horizontal axis
  heightCap: 0.96, // of the 1-unit volume height
  floorY: -0.5,
  centerZ: -0.5,
};

// bounds: { min: {x,y,z}, max: {x,y,z} } in anchor (face-seat) space.
export function computeVolumeSeat(bounds) {
  const size = {
    x: Math.max(0, bounds.max.x - bounds.min.x),
    y: Math.max(0, bounds.max.y - bounds.min.y),
    z: Math.max(0, bounds.max.z - bounds.min.z),
  };
  const center = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  let scale = Infinity;
  if (size.x > 0) scale = Math.min(scale, VOLUME_SEAT.footprint / size.x);
  if (size.z > 0) scale = Math.min(scale, VOLUME_SEAT.footprint / size.z);
  if (size.y > 0) scale = Math.min(scale, VOLUME_SEAT.heightCap / size.y);
  if (!isFinite(scale)) scale = 1;
  return {
    scale,
    position: {
      x: -scale * center.x,
      y: VOLUME_SEAT.floorY - scale * bounds.min.y,
      z: VOLUME_SEAT.centerZ - scale * center.z,
    },
  };
}
