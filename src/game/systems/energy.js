// Energy (shown as red eyes) and the items that restore it. Pure functions.
//
// Energy drains while you are out on the street (free roam and street
// modes), faster when running and in the rain. Items give energy now; some
// also "crash" later (a delayed energy loss) and build a hidden habit the
// story notices (Professor warns, Ada worries, Bassey takes notes).
// At 0 energy you collapse: the story jumps to the hospital (Rock Bottom branch).

import data from '../data/items.json'

export const ITEMS = data.items
export const VENDORS = data.vendors

export const DRAIN = {
  base: 0.07, // per second just being out there (~4 per minute)
  running: 0.22, // extra per second while running
  rain: 0.05, // extra per second in the rain
}
export const LOW_ENERGY = 20 // below this: staggering walk, no running

export function drainRate({ running = false, raining = false } = {}) {
  return DRAIN.base + (running ? DRAIN.running : 0) + (raining ? DRAIN.rain : 0)
}

/**
 * Using an item. Returns { stats, effects, message } or { error }.
 * stats: the stat changes; effects: timers to add to game.effects.
 */
export function useItem(itemId, game, clock) {
  const item = ITEMS[itemId]
  if (!item) return { error: 'Unknown item' }
  if ((game.stats.money ?? 0) < item.price) return { error: `You need ₦${item.price.toLocaleString('en-NG')}` }
  const stats = { money: -item.price, energy: item.energy }
  if (item.habit) stats.habit = item.habit
  const effects = item.crash ? [{ item: itemId, until: clock + item.duration, crash: item.crash }] : []
  return { stats, effects, message: `${item.name}: +${item.energy} energy` }
}

/** Effects whose time is up: returns { due, remaining, crash } */
export function dueEffects(effects = [], clock) {
  const due = effects.filter((e) => e.until <= clock)
  return { due, remaining: effects.filter((e) => e.until > clock), crash: due.reduce((s, e) => s + e.crash, 0) }
}
