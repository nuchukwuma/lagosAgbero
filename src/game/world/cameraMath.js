// Sight-line checks for the street camera (CameraRig.jsx). Obstacles are footprints:
// { x, z, hw, hd, angle, h } (half sizes, turn in radians, height in metres).

// How high must a street camera at `cam` stand to see the player at `p` over
// the roofs in between? 0 = nothing in the way.
export function blockedHeight(p, cam, obstacles, samples = [0.45, 0.7, 1]) {
  let need = 0
  for (const t of samples) {
    const x = p.x + (cam.x - p.x) * t
    const z = p.z + (cam.z - p.z) * t
    for (const o of obstacles) {
      if (o.h < 2.6 || (o.hw < 1 && o.hd < 1)) continue // low things and thin things (palm trees, poles) never block the view
      const dx = x - o.x
      const dz = z - o.z
      const c = Math.cos(o.angle)
      const s = Math.sin(o.angle)
      const lx = dx * c - dz * s
      const lz = dx * s + dz * c
      if (Math.abs(lx) < o.hw + 1 && Math.abs(lz) < o.hd + 1) need = Math.max(need, o.h + 2.5 + (1 - t) * 4)
    }
  }
  return need
}
