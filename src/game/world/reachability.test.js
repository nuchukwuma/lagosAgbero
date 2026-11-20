import { describe, it, expect } from 'vitest'
import { getLayout } from './worlds.js'

// Every "talk to X" goal in every chapter must be somewhere the player can
// walk to: the scene's "positions" put story-only characters on the map,
// otherwise they wait off-map (an easy slip: Ike, Grass to Grace chapter 2).
const chapters = import.meta.glob('../data/story/**/*.json', { eager: true, import: 'default' })
const worlds = import.meta.glob('../data/world/*.json', { eager: true, import: 'default' })
import items from '../data/items.json'
import questsData from '../data/quests.json'
import campaignsData from '../data/campaigns.json'

const inside = (c, x, z, pad) => {
  const dx = x - c.x
  const dz = z - c.z
  const co = Math.cos(c.angle || 0)
  const si = Math.sin(c.angle || 0)
  return Math.abs(dx * co - dz * si) < c.hw + pad && Math.abs(dx * si + dz * co) < c.hd + pad
}

const walkable = {}
function distanceFromWalkable(world, x, z) {
  if (!walkable[world]) {
    const L = getLayout(world)
    const b = L.bounds
    const step = 0.5
    const R = 0.35
    const free = (x, z) => x > b.minX + R && x < b.maxX - R && z > b.minZ + R && z < b.maxZ - R && !L.colliders.some((c) => inside(c, x, z, R))
    const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`
    const start = (L.spots.arrival || Object.values(L.spots)[0]).pos
    const seen = new Set([key(...start)])
    const queue = [start]
    const cells = []
    while (queue.length) {
      const [cx, cz] = queue.shift()
      cells.push([cx, cz])
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const k = key(cx + dx, cz + dz)
        if (seen.has(k) || !free(cx + dx, cz + dz)) continue
        seen.add(k)
        queue.push([cx + dx, cz + dz])
      }
    }
    walkable[world] = { L, cells }
  }
  let best = Infinity
  for (const [cx, cz] of walkable[world].cells) best = Math.min(best, Math.hypot(cx - x, cz - z))
  return best
}

describe('story goals can be reached', () => {
  it('everyone you are sent to talk to stands where you can walk up to them', () => {
    const problems = []
    for (const [file, ch] of Object.entries(chapters)) {
      for (const [sid, scene] of Object.entries(ch.scenes || {})) {
        const world = scene.world || ch.world
        if (!world) continue
        const targets = new Set([...JSON.stringify(scene.beats || []).matchAll(/"talkTo":\s*"(\w+)"/g)].map((m) => m[1]))
        for (const id of targets) {
          distanceFromWalkable(world, 0, 0)
          const pos = scene.positions?.[id] || walkable[world].L.raw.npcs?.find((n) => n.id === id)?.pos
          if (!pos) problems.push(`${file} ${sid}: ${id} is never placed`)
          else if (distanceFromWalkable(world, pos[0], pos[1]) > 2.2) problems.push(`${file} ${sid}: ${id} at ${pos} can't be reached`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('every character a scene places stands somewhere you can walk up to', () => {
    const problems = []
    for (const [file, ch] of Object.entries(chapters)) {
      for (const [sid, scene] of Object.entries(ch.scenes || {})) {
        const world = scene.world || ch.world
        if (!world || !scene.positions) continue
        for (const [id, pos] of Object.entries(scene.positions)) if (distanceFromWalkable(world, pos[0], pos[1]) > 2.2) problems.push(`${file} ${sid}: ${id} at ${pos}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every activity, shop and quest giver on a map can be reached', () => {
    const problems = []
    const quests = Array.isArray(questsData) ? questsData : questsData.quests || []
    const worldOfCampaign = Object.fromEntries((campaignsData.campaigns || campaignsData).map((c) => [c.id, c.world]))
    for (const [file, w] of Object.entries(worlds)) {
      const id = w.id || file.split('/').pop().replace('.json', '')
      if (!w.spots) continue
      // a quest giver only has to be reachable in the world of the quest's own story
      const givers = quests.filter((q) => worldOfCampaign[q.campaign || 'areaBoy'] === id).map((q) => q.giver)
      const needed = new Set([...Object.keys(items.vendors || {}), ...givers])
      for (const a of w.activities || []) {
        const spot = w.spots[a.spot]
        if (!spot) problems.push(`${id}: activity ${a.id} has no spot ${a.spot}`)
        else if (distanceFromWalkable(id, spot.pos[0], spot.pos[1]) > 2.5) problems.push(`${id}: activity ${a.id} at ${spot.pos}`)
      }
      for (const n of w.npcs || []) {
        if (!needed.has(n.id)) continue
        // story-only characters wait off the map on purpose; a shop or quest giver must not
        if (distanceFromWalkable(id, n.pos[0], n.pos[1]) > 2.2) problems.push(`${id}: ${n.id} (shop or quest giver) at ${n.pos}`)
      }
    }
    expect(problems).toEqual([])
  })
})
