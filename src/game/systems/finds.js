// Street finds: small things lying around during free roam (a naira note, a
// sachet of water, a lost ID card). They give the player a reason to wander.
// The same finds appear in the same places until the day or chapter changes.
// Pure logic: no React, no three.js.

import FINDS from '../data/finds.json'
import { mulberry32 } from '../world/cityFill.js'
import { resolveCollisions } from '../world/layout.js'

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Finds reset when this key changes (a new day, a new chapter, another world). */
export const findsKey = (layoutId, game) => `${layoutId}:${game.story?.chapterId}:${game.stats?.day ?? 1}`

function pickKind(rng, campaign) {
  const options = Object.entries(FINDS.kinds).filter(([, k]) => !k.campaigns || k.campaigns.includes(campaign))
  let roll = rng() * options.reduce((s, [, k]) => s + k.weight, 0)
  for (const [id, k] of options) if ((roll -= k.weight) <= 0) return id
  return options[0][0]
}

/**
 * Where today's finds lie in this world: [{ id, kind, x, z, amount }]
 * (already-collected ones left out). Places are near the named spots, never
 * inside a building, never on top of a spot the story teleports you to.
 */
export function findsFor(layout, game) {
  const key = findsKey(layout.id, game)
  const rng = mulberry32(hash(key))
  const spots = Object.values(layout.spots || {}).map((s) => s.pos)
  if (!spots.length) return []
  const b = layout.bounds
  const out = []
  for (let attempt = 0; attempt < 200 && out.length < FINDS.perWorld; attempt++) {
    const [sx, sz] = spots[Math.floor(rng() * spots.length)]
    const angle = rng() * Math.PI * 2
    const dist = 4 + rng() * 8
    const x = sx + Math.cos(angle) * dist
    const z = sz + Math.sin(angle) * dist
    const kind = pickKind(rng, game.campaign || 'areaBoy')
    const [lo, hi] = FINDS.kinds[kind].money || [0, 0]
    const amount = Math.round((lo + rng() * (hi - lo)) / 50) * 50
    if (x < b.minX + 2 || x > b.maxX - 2 || z < b.minZ + 2 || z > b.maxZ - 2) continue
    const probe = { x, z }
    resolveCollisions(probe, 0.7, layout.colliders, null)
    if (Math.hypot(probe.x - x, probe.z - z) > 0.01) continue // inside or against something
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue
    if (out.some((f) => Math.hypot(f.x - x, f.z - z) < 6)) continue
    out.push({ id: out.length, kind, x, z, amount })
  }
  const taken = game.finds?.key === key ? game.finds.taken : []
  return out.filter((f) => !taken.includes(f.id))
}

/** What picking one up does: { effects, text, finds } (finds = the new record to store on the game). */
export function collectFind(find, layoutId, game) {
  const key = findsKey(layoutId, game)
  const kind = FINDS.kinds[find.kind]
  const taken = game.finds?.key === key ? game.finds.taken : []
  if (!kind || taken.includes(find.id)) return null
  const changeStat = { ...(kind.stats || {}) }
  if (find.amount) changeStat.money = find.amount
  const line = kind.text[(find.id + (game.stats?.day ?? 1)) % kind.text.length]
  return {
    effects: { changeStat },
    text: line.replace('{amount}', `₦${find.amount.toLocaleString('en-NG')}`),
    finds: { key, taken: [...taken, find.id], total: (game.finds?.total || 0) + 1 },
  }
}

export const findColour = (kind) => FINDS.kinds[kind]?.colour || '#3f9b4b'
