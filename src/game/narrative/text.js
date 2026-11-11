// Text helpers: placeholders and variants.
//
// Placeholders in any story text:
//   {name}      the player's name
//   {nickname}  the player's street name ("JJC" until earned)
//   {money} {hustleMoney} {cultMoney} {debt}  formatted as naira
//   {stat:friendBond}   any stat as a plain number
//
// Variants: a dialogue beat can carry
//   "variants": [ { "if": <condition>, "text": "...", "speaker": "..." } ]
// The first variant whose condition is true replaces the beat's text.

import { checkCondition } from './conditions.js'
import { formatNaira } from './stats.js'

const MONEY_KEYS = new Set(['money', 'hustleMoney', 'cultMoney', 'debt'])

export function interpolate(text, state) {
  if (!text) return ''
  return text.replace(/\{(\w+)(?::(\w+))?\}/g, (whole, key, arg) => {
    if (key === 'name') return state.player.name
    if (key === 'nickname') return state.player.nickname
    if (key === 'stat' && arg) return String(Math.round(state.stats[arg] ?? 0))
    if (MONEY_KEYS.has(key)) return formatNaira(state.stats[key] ?? 0)
    return whole
  })
}

/** Picks the first matching variant, falling back to the beat itself. */
export function pickVariant(beat, state) {
  for (const v of beat.variants || []) {
    if (checkCondition(v.if, state)) return { speaker: v.speaker ?? beat.speaker, text: v.text, mood: v.mood ?? beat.mood }
  }
  return { speaker: beat.speaker, text: beat.text, mood: beat.mood }
}
