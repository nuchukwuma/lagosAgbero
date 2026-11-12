// Wardrobe rules (pure): what an outfit costs, what "style" it gives, and
// which nicknames the player has earned. Looks change reactions:
//   style_flashy  drivers pay more (fees), the Zone 5 gate gives less, Bassey notices
//   style_sharp   drivers argue a little less
//   style_plain   nothing special
import data from '../data/wardrobe.json'
import { checkCondition } from '../narrative/conditions.js'

export const WARDROBE = data
const STYLE_RANK = { plain: 0, sharp: 1, flashy: 2 }

export function styleOf(look = {}) {
  let best = data.outfits.find((o) => o.id === look.body)?.style || 'plain'
  for (const a of look.accessories || []) {
    const s = data.accessories.find((x) => x.type === a.type && (!x.id || x.id === a.id))?.style || 'plain'
    if (STYLE_RANK[s] > STYLE_RANK[best]) best = s
  }
  return best
}

/** Fair fee bonus drivers accept for a style. */
export function feeBonus(style) {
  return style === 'flashy' ? 75 : style === 'sharp' ? 25 : 0
}

/** The bill for going from `before` to `after` (only new things cost money). */
export function costOf(before = {}, after = {}, owned = []) {
  let cost = 0
  if (after.body !== before.body && !owned.includes(`outfit:${after.body}`)) cost += data.outfits.find((o) => o.id === after.body)?.price || 0
  for (const a of after.accessories || []) {
    const key = `acc:${a.id || a.type}`
    const def = data.accessories.find((x) => x.type === a.type && (!x.id || x.id === a.id))
    if (!owned.includes(key) && !(before.accessories || []).some((b) => (b.id || b.type) === (a.id || a.type))) cost += def?.price || 0
  }
  return cost
}

/** Items newly owned after buying `after`. */
export function ownedAfter(after = {}, owned = []) {
  const set = new Set(owned)
  set.add(`outfit:${after.body}`)
  for (const a of after.accessories || []) set.add(`acc:${a.id || a.type}`)
  return [...set]
}

export function earnedNicknames(game, entitlements = []) {
  return data.nicknames.filter((n) => (n.entitlement ? entitlements.includes(n.entitlement) : checkCondition(n.if, game))).map((n) => n.name)
}

export function styleFlags(style) {
  return { style_plain: style === 'plain', style_sharp: style === 'sharp', style_flashy: style === 'flashy' }
}
