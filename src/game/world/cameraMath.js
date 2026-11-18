// Sight-line checks for the camera (CameraRig.jsx). Obstacles are footprints:
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

// How high must a fight camera on that side stand to see the fighters' feet
// over whatever is in between? Unlike the street camera, anything above waist
// height counts here, parked and stopped vehicles too: a danfo is enough to
// hide two fighters. side: 1 = camera south of the fight, -1 = north.
// 0 = nothing in the way.
export function fightSideBlock(c, side, dist, obstacles, spread = 1.6) {
  let need = 0
  for (const o of obstacles) {
    if (o.h < 1.2) continue
    const co = Math.abs(Math.cos(o.angle))
    const si = Math.abs(Math.sin(o.angle))
    const ex = o.hw * co + o.hd * si // half extent along x and z
    const ez = o.hw * si + o.hd * co
    if (Math.abs(o.x - c.x) > ex + spread + 0.3) continue // beside the fight, not in front of it
    // its edge nearest the fighters, measured towards the camera
    const near = side * (o.z - c.z) - ez - 0.3
    const far = side * (o.z - c.z) + ez + 0.3
    if (far <= 0 || near >= dist) continue // behind the fighters, or behind the camera
    // the sight line to the feet rises as it nears the camera: at `near` it is at H * near / dist
    const t = Math.max(near, 0.35) / dist
    need = Math.max(need, (o.h + 0.35) / t)
  }
  return need
}
