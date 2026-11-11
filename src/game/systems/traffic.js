// Traffic on the main road. Plain data + an update function (no React), so
// gameplay modes can add vehicles that stop where the story needs them.
//
// Lanes (Nigeria drives on the right):
//   west  z = -2  moving -X  (north lane, beside the bus stops)
//   east  z = +2  moving +X
//
// A vehicle: { id, kind, lane, x, speed, maxSpeed, length, width,
//              stopAt: null | { x, wait }, state, waited, hold, tag }
//   stopAt.x  where the FRONT of the vehicle should stop
//   hold      true while the player is dealing with it (it won't leave)

import vehicleData from '../data/vehicles.json'

export const LANES = {
  west: { z: -2, dir: -1 },
  east: { z: 2, dir: 1 },
}
export const SPAWN_X = 90
const DESPAWN_X = 96
const ACCEL = 4
const BRAKE = 9
const MIN_GAP = 2.2

export const traffic = { vehicles: [], nextId: 1, version: 0 }

export function kindInfo(kind) {
  return vehicleData.kinds[kind] || vehicleData.kinds.danfo
}

/** Add a vehicle at the start of its lane. Returns it, or null if the lane mouth is blocked. */
export function spawnVehicle({ kind = 'danfo', lane = 'west', speed, stopAt = null, tag = {}, slogan = null, color = null, riderLook = null, force = false }) {
  const L = LANES[lane]
  const info = kindInfo(kind)
  const x = -L.dir * SPAWN_X
  const blocked = traffic.vehicles.some((v) => v.lane === lane && Math.abs(v.x - x) < info.length + 4)
  if (blocked && !force) return null
  const v = {
    id: traffic.nextId++,
    kind,
    lane,
    x,
    speed: speed ?? info.maxSpeed * 0.8,
    maxSpeed: info.maxSpeed * (0.85 + Math.random() * 0.3),
    length: info.length,
    width: info.width,
    stopAt,
    state: 'driving',
    waited: 0,
    hold: false,
    tag,
    slogan,
    color,
    riderLook,
  }
  traffic.vehicles.push(v)
  traffic.version++
  return v
}

export function removeVehicle(id) {
  const i = traffic.vehicles.findIndex((v) => v.id === id)
  if (i >= 0) {
    traffic.vehicles.splice(i, 1)
    traffic.version++
  }
}

export function clearTraffic() {
  traffic.vehicles.length = 0
  traffic.version++
}

/** Let a stopped vehicle drive off (optionally fast, e.g. a fleeing defaulter). */
export function releaseVehicle(v, { speedBoost = 1 } = {}) {
  v.stopAt = null
  v.hold = false
  v.state = 'leaving'
  v.maxSpeed *= speedBoost
}

const front = (v) => v.x + LANES[v.lane].dir * (v.length / 2)

/** Advance all vehicles by dt seconds. `player` is {x, z} or null. */
export function updateTraffic(dt, player) {
  const lanes = { west: [], east: [] }
  for (const v of traffic.vehicles) lanes[v.lane].push(v)

  for (const [laneName, list] of Object.entries(lanes)) {
    const L = LANES[laneName]
    // order: the vehicle furthest along the lane first
    list.sort((a, b) => (b.x - a.x) * L.dir)
    for (let i = 0; i < list.length; i++) {
      const v = list[i]
      const ahead = list[i - 1]
      let target = v.maxSpeed

      // keep distance from the vehicle ahead
      if (ahead) {
        const gap = (ahead.x - v.x) * L.dir - (ahead.length / 2 + v.length / 2)
        const safe = MIN_GAP + v.speed * 0.6
        if (gap < safe) target = Math.min(target, Math.max(0, (gap - MIN_GAP) * 2))
      }

      // stop at a bus stop
      if (v.stopAt && v.state !== 'leaving') {
        const dist = (v.stopAt.x - front(v)) * L.dir
        if (dist <= 0.15) {
          target = 0
          if (v.speed < 0.3) {
            if (v.state !== 'stopped') v.state = 'stopped'
            if (!v.hold) v.waited += dt
            if (v.stopAt.wait != null && v.waited >= v.stopAt.wait && !v.hold) releaseVehicle(v)
          }
        } else {
          target = Math.min(target, Math.sqrt(2 * BRAKE * 0.7 * dist))
          if (v.state === 'driving') v.state = 'stopping'
        }
      }

      // never run anybody over: stop for the player standing in the lane
      if (player && Math.abs(player.z - L.z) < v.width / 2 + 0.6) {
        const d = (player.x - v.x) * L.dir - v.length / 2
        if (d > -0.5 && d < 3.5 + v.speed * 0.5) target = 0
      }

      const a = target > v.speed ? ACCEL : BRAKE
      v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), a * dt)
      v.x += L.dir * v.speed * dt
    }
  }

  // remove vehicles that drove off the map
  const before = traffic.vehicles.length
  traffic.vehicles = traffic.vehicles.filter((v) => Math.abs(v.x) < DESPAWN_X)
  if (traffic.vehicles.length !== before) traffic.version++
}

/** Rotated boxes for player collisions. */
export function vehicleColliders() {
  return traffic.vehicles.map((v) => ({ x: v.x, z: LANES[v.lane].z, hw: v.length / 2, hd: v.width / 2, angle: 0 }))
}

/** Pick a random kind using the weights in vehicles.json. */
export function randomKind(rng = Math.random) {
  const entries = Object.entries(vehicleData.kinds).filter(([, k]) => k.weight > 0)
  const total = entries.reduce((s, [, k]) => s + k.weight, 0)
  let r = rng() * total
  for (const [name, k] of entries) {
    r -= k.weight
    if (r < 0) return name
  }
  return 'danfo'
}

export function randomSlogan(rng = Math.random) {
  return vehicleData.slogans[Math.floor(rng() * vehicleData.slogans.length)]
}
