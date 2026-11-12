// Every 3D place a story can happen in (data: src/game/data/world/*.json).
// A chapter (or a single scene) says "world": "nkwoAgu"; Iyana-Wahala is the
// default. Layouts are built on first use and cached.
import iyanaWahala from '../data/world/iyanaWahala.json'
import nkwoAgu from '../data/world/nkwoAgu.json'
import royalCrest from '../data/world/royalCrest.json'
import { parseLayout } from './layout.js'
import { storyCtx } from '../narrative/storyData.js'

export const WORLDS = { iyanaWahala, nkwoAgu, royalCrest }
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

export function getLayout(id = DEFAULT_WORLD) {
  const key = WORLDS[id] ? id : DEFAULT_WORLD
  if (!cache.has(key)) cache.set(key, parseLayout(WORLDS[key], { reserved: storyMarks(key) }))
  return cache.get(key)
}
