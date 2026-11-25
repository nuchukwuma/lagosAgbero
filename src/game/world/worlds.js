// Every 3D place a story can happen in (data: src/game/data/world/*.json).
// A chapter (or a single scene) says "world": "nkwoAgu"; Iyana-Wahala is the
// default. Layouts are built on first use. Only the world you're in stays
// cached: a layout holds thousands of generated props, and keeping every
// world you've visited cost tens of MB on 2 GB phones. Coming back rebuilds
// it (a fraction of a second; it's generated from a seed, so it's identical).
import iyanaWahala from '../data/world/iyanaWahala.json'
import nkwoAgu from '../data/world/nkwoAgu.json'
import royalCrest from '../data/world/royalCrest.json'
import { parseLayout } from './layout.js'
import { storyCtx } from '../narrative/storyData.js'
import { useSettings, effectiveQuality } from '../store/settings.js'

// buildings you can walk into: small worlds of their own (data/world/interiors/*.json)
const INTERIORS = Object.fromEntries(Object.values(import.meta.glob('../data/world/interiors/*.json', { eager: true, import: 'default' })).map((w) => [w.id, w]))
export const WORLDS = { iyanaWahala, nkwoAgu, royalCrest, ...INTERIORS }
export const isInterior = (id) => Boolean(WORLDS[id]?.interior)
export const DEFAULT_WORLD = 'iyanaWahala'
const cache = new Map()

export const worldJson = (id) => WORLDS[id] || WORLDS[DEFAULT_WORLD]

// Every mark a story places a character on in this world, so generated
// clutter (kiosks, drums...) never lands where somebody has to stand.
function storyMarks(id) {
  const marks = []
  for (const ch of Object.values(storyCtx.chapters)) {
    for (const sc of Object.values(ch.scenes || {})) {
      if ((sc.world || ch.world || DEFAULT_WORLD) !== id) continue
      for (const p of Object.values(sc.positions || {})) marks.push([p[0], p[1], 1.8])
    }
  }
  return marks
}

/** Is the light version of the worlds in use (2 GB phones, or chosen in Settings)? */
export const liteWorlds = () => effectiveQuality(useSettings.getState().quality) === 'low'

export function getLayout(id = DEFAULT_WORLD, lite = liteWorlds()) {
  const name = WORLDS[id] ? id : DEFAULT_WORLD
  const key = `${name}|${lite ? 'lite' : 'full'}`
  if (!cache.has(key)) {
    cache.clear()
    cache.set(key, parseLayout(WORLDS[name], { reserved: storyMarks(name), lite }))
  }
  return cache.get(key)
}
