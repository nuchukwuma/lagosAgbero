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

const deg = (a) => ((-a * 180) / Math.PI).toFixed(1)

/**
 * The map as one picture (an SVG file), for the corner map: drawn once per
 * world, then slid around under the player's arrow, which costs the phone
 * almost nothing (redrawing the map every frame cost ~3 ms a frame).
 * Same colours as the full map (styles.css .map-*). Units: world metres.
 */
export function mapPicture(map, margin = 40) {
  const b = map.bounds
  const x0 = b.minX - margin
  const z0 = b.minZ - margin
  const w = b.maxX - b.minX + margin * 2
  const h = b.maxZ - b.minZ + margin * 2
  const rect = (r, fill, extra = '') => `<rect x="${(-r.w / 2).toFixed(2)}" y="${(-r.d / 2).toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.d.toFixed(2)}" transform="translate(${r.x.toFixed(2)} ${r.z.toFixed(2)}) rotate(${deg(r.angle)})" fill="${fill}"${extra}/>`
  const parts = [
    `<rect x="${x0}" y="${z0}" width="${w}" height="${h}" fill="#d9c49f"/>`,
    ...map.pavements.map((p) => `<rect x="${p.x}" y="${p.z}" width="${p.w}" height="${p.d}" fill="#b9b0a2"/>`),
    ...map.roads.map((r) => rect({ ...r, w: r.w + 0.1, d: r.d + 0.1 }, '#55534f')),
    ...map.blocks.map((r) => rect(r, '#9c7b58', ' stroke="#6e5338" stroke-width="0.25"')),
    ...map.places.map((p) => `<circle cx="${p.x}" cy="${p.z}" r="1.3" fill="${p.activity ? '#ff8a3d' : '#f2c300'}" stroke="#3a2a10" stroke-width="0.35"/>`),
  ]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${z0} ${w} ${h}" width="${Math.round(w * 4)}" height="${Math.round(h * 4)}">${parts.join('')}</svg>`
  return { svg, x0, z0, w, h }
}
