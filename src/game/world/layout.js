// Turns a world layout JSON (src/game/data/world/*.json) into:
//   groups     [{ model, items: [{ position, rotation, scale }], solid, wires }]
//   colliders  [{ x, z, hw, hd, angle }]  rotated boxes the player can't enter
//   spots      named places the story uses (arrival, backSide, adaShop...)
//
// Item shorthand in JSON: "at": [[x, z, rotationDeg, scale], ...]
// or a line: "line": { "from": [x, z], "to": [x, z], "step": 8 }, "skip": [[x, z]]

import { getAsset } from '../../assets/assetManifest.js'
import { generateFill } from './cityFill.js'
import { buildStalls } from './stalls.js'

// Kenney road tiles have their asphalt at y = 0 (only kerbs rise to 0.16 m),
// so people, buildings and pavements stand just above zero.
export const GROUND_Y = 0.02
const DEG = Math.PI / 180

function expandItems(group, y = GROUND_Y) {
  const out = []
  const push = (x, z, rot, scale) => out.push({ position: [x, group.y ?? y, z], rotation: rot ?? group.rotation ?? 0, scale: scale ?? group.scale ?? 1 })
  for (const a of group.at || []) push(a[0], a[1], a[2], a[3])
  if (group.line) {
    const { from, to, step } = group.line
    const len = Math.hypot(to[0] - from[0], to[1] - from[1])
    const n = Math.max(1, Math.round(len / step))
    for (let i = 0; i <= n; i++) {
      const x = from[0] + ((to[0] - from[0]) * i) / n
      const z = from[1] + ((to[1] - from[1]) * i) / n
      if ((group.skip || []).some(([sx, sz]) => Math.abs(sx - x) < 0.01 && Math.abs(sz - z) < 0.01)) continue
      push(x, z)
    }
  }
  return out
}

function rotate(x, z, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c + z * s, -x * s + z * c]
}

function modelCollider(model, item, shrink = 0.92) {
  const a = getAsset(model)
  const sc = Array.isArray(item.scale) ? item.scale : [item.scale, item.scale, item.scale]
  const angle = (Array.isArray(item.rotation) ? item.rotation[1] : item.rotation) * DEG
  const [ox, oz] = rotate(a.offset[0] * sc[0], a.offset[2] * sc[2], angle)
  return {
    x: item.position[0] + ox,
    z: item.position[2] + oz,
    hw: Math.max(0.15, (a.size[0] * sc[0] * shrink) / 2),
    hd: Math.max(0.15, (a.size[2] * sc[2] * shrink) / 2),
    angle,
  }
}

export const STALL_SIZE = { big: [6.6, 4.6], small: [2.4, 1.6] }

/**
 * @param json     world layout JSON
 * @param options  { reserved: [[x, z, radius?], ...] } places the story uses,
 *                 so generated street clutter never lands on them
 */
export function parseLayout(json, { reserved = [] } = {}) {
  const groups = []
  const colliders = []
  const shadows = [] // footprints + heights, for the fake sun shadows
  const add = (list, kind, y) => {
    for (const g of list || []) {
      const items = expandItems(g, y)
      groups.push({ kind, model: g.model, items, solid: Boolean(g.solid), wires: g.wires || null })
      if (g.solid) for (const it of items) colliders.push(modelCollider(g.model, it))
      if (kind === 'building' || kind === 'vehicle' || (kind === 'prop' && g.solid && !g.wires)) {
        const a = getAsset(g.model)
        for (const it of items) {
          const sc = Array.isArray(it.scale) ? it.scale[1] : it.scale
          shadows.push({ ...modelCollider(g.model, it, 1), h: a.size[1] * sc })
        }
      }
    }
  }
  add(json.roads, 'road', 0)
  add(json.props, 'prop')
  add(json.buildings, 'building')
  add(json.vehicles, 'vehicle')

  for (const s of json.stalls || []) {
    const [w, d] = s.small ? STALL_SIZE.small : STALL_SIZE.big
    colliders.push({ x: s.at[0], z: s.at[1] + (s.small ? 0 : -0.6), hw: w / 2, hd: d / 2, angle: (s.at[2] || 0) * DEG })
  }
  const f = json.flyover
  if (f) for (const z of f.pillars) for (const side of [-1, 1]) colliders.push({ x: f.x + side * (f.width / 2 - 1.5), z, hw: 0.7, hd: 0.7, angle: 0 })

  for (const s of json.stalls || []) {
    const [w, d] = s.small ? STALL_SIZE.small : STALL_SIZE.big
    shadows.push({ x: s.at[0], z: s.at[1] + (s.small ? 0 : -0.6), hw: w / 2, hd: d / 2, angle: (s.at[2] || 0) * DEG, h: s.small ? 2.3 : 2.9 })
  }

  // generated rows of buildings, street clutter and the far skyline
  const marks = [
    ...reserved,
    ...Object.values(json.spots || {}).map((s) => [s.pos[0], s.pos[1], Math.min(s.radius || 2, 3.2)]),
    ...(json.npcs || []).map((n) => [n.pos[0], n.pos[1]]),
    ...(json.extras || []).map((n) => [n.pos[0], n.pos[1]]),
    [json.spawn.pos[0], json.spawn.pos[1], 3],
  ]
  const fill = generateFill(json, colliders, marks)
  groups.push(...fill.groups)
  // market stalls: containers join the batched models, the rest the props
  const stalls = buildStalls(json.stalls)
  groups.push(...stalls.groups)
  fill.prims.push(...stalls.prims)
  colliders.push(...fill.colliders)
  shadows.push(...fill.shadows)

  return { id: json.id, name: json.name, bounds: json.bounds, spawn: json.spawn, groups, colliders, shadows, fill, spots: json.spots || {}, raw: json }
}

/** Push a circle (player) out of every collider and keep it inside bounds. */
export function resolveCollisions(pos, radius, colliders, bounds) {
  for (const c of colliders) {
    // into the box's local frame
    const dx = pos.x - c.x
    const dz = pos.z - c.z
    const [lx, lz] = rotate(dx, dz, -c.angle)
    const cx = Math.max(-c.hw, Math.min(c.hw, lx))
    const cz = Math.max(-c.hd, Math.min(c.hd, lz))
    let nx = lx - cx
    let nz = lz - cz
    const dist = Math.hypot(nx, nz)
    if (dist >= radius) continue
    if (dist < 1e-6) {
      // centre inside the box: push out along the shallowest side
      const px = c.hw - Math.abs(lx)
      const pz = c.hd - Math.abs(lz)
      if (px < pz) { nx = Math.sign(lx) || 1; nz = 0 } else { nx = 0; nz = Math.sign(lz) || 1 }
      const push = (px < pz ? px : pz) + radius
      const [wx, wz] = rotate(nx * push, nz * push, c.angle)
      pos.x += wx
      pos.z += wz
      continue
    }
    const push = radius - dist
    const [wx, wz] = rotate((nx / dist) * push, (nz / dist) * push, c.angle)
    pos.x += wx
    pos.z += wz
  }
  if (bounds) {
    pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x))
    pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z))
  }
  return pos
}
