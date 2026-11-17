// What the in-game map draws, worked out once per world from its layout:
// roads, pavements, buildings and other solid things, and the named places
// (world JSON "mapLabels") with the activities you can start there.
// Map coordinates are world metres: x to the right (east), z down (south),
// so north (-Z, where W walks) is up.

import { getAsset } from '../../assets/assetManifest.js'

const DEG = Math.PI / 180

function footprint(model, item) {
  const a = getAsset(model)
  if (!a?.size) return null
  const sc = Array.isArray(item.scale) ? item.scale : [item.scale ?? 1, item.scale ?? 1, item.scale ?? 1]
  const angle = (Array.isArray(item.rotation) ? item.rotation[1] : item.rotation || 0) * DEG
  const ox = (a.offset?.[0] || 0) * sc[0]
  const oz = (a.offset?.[2] || 0) * sc[2]
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: item.position[0] + ox * c + oz * s, z: item.position[2] - ox * s + oz * c, w: a.size[0] * sc[0], d: a.size[2] * sc[2], angle }
}

export function buildMap(layout) {
  const roads = []
  const buildings = []
  for (const g of layout.groups) {
    const cat = getAsset(g.model)?.category
    if (cat !== 'road' && cat !== 'building') continue
    for (const item of g.items) {
      const f = footprint(g.model, item)
      if (f) (cat === 'road' ? roads : buildings).push(f)
    }
  }
  // stalls, sheds and other solid things big enough to see
  const blocks = layout.colliders.filter((c) => c.hw * c.hd >= 1.5).map((c) => ({ x: c.x, z: c.z, w: c.hw * 2, d: c.hd * 2, angle: c.angle }))
  const pavements = (layout.raw.pavements || []).map((p) => ({ x: p.rect[0], z: p.rect[1], w: p.rect[2], d: p.rect[3], color: p.color }))
  const labels = layout.raw.mapLabels || {}
  const activities = new Map()
  for (const a of layout.raw.activities || []) if (!activities.has(a.spot)) activities.set(a.spot, a.label)
  const places = Object.entries(labels)
    .filter(([id]) => layout.spots[id])
    .map(([id, name]) => ({ id, name, x: layout.spots[id].pos[0], z: layout.spots[id].pos[1], activity: activities.get(id) || null }))
  return { id: layout.id, name: layout.name, bounds: layout.bounds, roads, buildings, blocks, pavements, places }
}

/** Where the current story goal is, in world metres (or null). */
export function goalPoint(goal, layout, npcs) {
  if (!goal) return null
  if (goal.reach && layout.spots[goal.reach]) {
    const s = layout.spots[goal.reach]
    return { x: s.pos[0], z: s.pos[1], label: layout.raw.mapLabels?.[goal.reach] || null }
  }
  if (goal.talkTo && npcs?.get(goal.talkTo)) {
    const n = npcs.get(goal.talkTo)
    return { x: n.position.x, z: n.position.z, label: null, who: goal.talkTo }
  }
  return null
}

/** Compass words for a direction from (x, z) to (tx, tz). */
export function compass(x, z, tx, tz) {
  const a = Math.atan2(tx - x, -(tz - z)) // 0 = north, clockwise
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
  return names[Math.round(((a / (Math.PI * 2)) * 8 + 8)) % 8]
}
