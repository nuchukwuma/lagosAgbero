// Random street events. Pure: pick an event for the current state.
// More notoriety = events come more often and bigger ones unlock
// (events.json "minNotoriety"). "once" events happen a single time
// (remembered with the flag "event_<id>").

import data from '../data/events.json'
import { checkCondition } from '../narrative/conditions.js'

export const EVENTS = data.events
export const ROLL_EVERY = data.rollEveryMinutes

/** Chance that a roll produces an event at all. */
export function eventChance(notoriety = 0) {
  return Math.min(0.9, 0.35 + notoriety / 200)
}

export function eligibleEvents(state) {
  const n = state.stats.notoriety ?? 0
  return EVENTS.filter((e) => (e.minNotoriety ?? 0) <= n && !(e.once && state.flags[`event_${e.id}`]) && checkCondition(e.if, state))
}

export function pickEvent(state, rng = Math.random) {
  if (rng() > eventChance(state.stats.notoriety)) return null
  const pool = eligibleEvents(state)
  const total = pool.reduce((s, e) => s + (e.weight ?? 1), 0)
  let r = rng() * total
  for (const e of pool) {
    r -= e.weight ?? 1
    if (r < 0) return e
  }
  return pool[pool.length - 1] || null
}
