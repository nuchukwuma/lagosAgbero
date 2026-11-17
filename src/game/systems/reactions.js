// How the street reacts to what the player does (data: reactions.json).
// Pure helpers: which line someone says, what an action does to the stats,
// how warmly someone greets you. The 3D side is ReactionDirector.jsx; the
// store applies the effects (gameStore.react).

import data from '../data/reactions.json'
import { STAT_DEFS } from '../narrative/stats.js'

export const REACTIONS = data

/** Each story's own names for "standing", "heat" and "fear". */
export function statsFor(campaign) {
  return data.stats[campaign] || data.stats.areaBoy
}

/** A line for this kind of reaction, in this story's voice. */
export function lineFor(kind, campaign, { name = '', nick = '' } = {}, rng = Math.random) {
  const set = data.lines[kind]
  const list = set?.[campaign] || set?.areaBoy || []
  if (!list.length) return ''
  const line = list[Math.floor(rng() * list.length) % list.length]
  return line.replaceAll('{name}', name).replaceAll('{nick}', nick || name)
}

/** changeStat for an action ("apologise", "argueWon"...), in this story's stats. */
export function effectsFor(action, campaign) {
  const e = data.effects[action]
  if (!e) return {}
  const names = statsFor(campaign)
  const changeStat = {}
  for (const [k, v] of Object.entries(e)) {
    const key = names[k] || k
    changeStat[key] = (changeStat[key] || 0) + v
  }
  return changeStat
}

/**
 * Does arguing make the driver back down? More likely the more the street
 * fears you, less likely if you've made a habit of it.
 */
export function argueChance(stats, campaign, roadRage = 0) {
  const fear = stats[statsFor(campaign).fear] ?? 0
  return Math.max(0.1, Math.min(0.85, 0.3 + fear / 150 - roadRage * 0.05))
}

/** How long a driver waits (seconds) before getting out; less if they know you. */
export function patience(roadRage = 0) {
  return Math.max(2.5, 4.5 - roadRage * 0.5)
}

/**
 * "warm", "cold" or null (nothing to say) for a story character, from your
 * history with them: compared with where the relationship started, so a
 * stranger isn't cold to you, someone you let down is.
 */
export function greetingTier(characterId, stats) {
  const spec = data.greet[characterId]
  if (!spec) return null
  const [stat, inverse] = spec.split(':')
  const v = stats[stat]
  if (v == null) return null
  const start = STAT_DEFS[stat]?.start ?? 0
  if (inverse) {
    // e.g. Task Force heat: the hotter, the colder the greeting
    if (v >= Math.max(60, start + 40)) return 'cold'
    return null
  }
  if (v >= Math.max(60, start + 25)) return 'warm'
  if (v <= start - 15) return 'cold'
  return null
}
