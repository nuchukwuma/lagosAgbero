// Fee collection rules. Pure functions, so they're easy to test and tune.
//
// The player's stop fee is a stat (`stopFee`, default ₦500 for a danfo).
// Other vehicles pay a share of it (vehicles.json feeFactor): keke 40%,
// okada 20%, taxi 60%, lorry 200%...
// The "fair fee" is what drivers think is normal. The economy (fuel hike,
// Phase 5/12) moves it. Charging above it makes drivers haggle, refuse and
// talk badly about you; charging below it earns goodwill but less money.

import drivers from '../data/drivers.json'
import { kindInfo } from './traffic.js'

export const BASE_FAIR_FEE = 500

const round50 = (n) => Math.max(50, Math.round(n / 50) * 50)

export function feeFor(kind, stopFee) {
  return round50(stopFee * kindInfo(kind).feeFactor)
}

/**
 * How a driver reacts when asked for `fee`.
 * driver: { tolerance (0..2, how much above fair they accept), stingy (0..1) }
 * returns { type: 'pay' | 'haggle' | 'refuse', amount, overcharged }
 */
export function driverResponse(driver, fee, fairFee, rng = Math.random) {
  const ratio = fee / Math.max(1, fairFee)
  const tol = driver.tolerance ?? 1
  const stingy = driver.stingy ?? 0.5
  const overcharged = ratio > 1.1
  const roll = rng()
  if (ratio <= tol - 0.2) return { type: roll < stingy * 0.15 ? 'haggle' : 'pay', amount: fee, offer: round50(fee * 0.7), overcharged }
  if (ratio <= tol) return roll < stingy * 0.5 ? { type: 'haggle', amount: fee, offer: round50(fee * (0.5 + rng() * 0.3)), overcharged } : { type: 'pay', amount: fee, overcharged }
  if (ratio <= tol + 0.4) return roll < 0.7 ? { type: 'haggle', amount: fee, offer: round50(fee * (0.4 + rng() * 0.3)), overcharged } : { type: 'refuse', amount: 0, overcharged }
  return { type: 'refuse', amount: 0, overcharged }
}

/** Player insists on the full fee after a haggle. */
export function insist(driver, rng = Math.random) {
  return rng() > (driver.stingy ?? 0.5) * 0.8 ? 'pay' : 'refuse'
}

/** Player threatens a refusing driver. Notoriety makes threats work better. */
export function threaten(driver, notoriety = 0, rng = Math.random) {
  const chance = 0.45 + notoriety / 200 - (driver.stingy ?? 0.5) * 0.2
  return rng() < chance ? 'pay' : 'refuse'
}

/** Street reaction to one exchange: { communityGoodwill, notoriety } deltas. */
export function reaction(kind) {
  switch (kind) {
    case 'paidFair':
      return { communityGoodwill: 0.3 }
    case 'paidOver':
      return { communityGoodwill: -0.6 }
    case 'acceptedLess':
      return { communityGoodwill: 0.4 }
    case 'letGo':
      return { communityGoodwill: 0.8 }
    case 'threatened':
      return { communityGoodwill: -1.2, notoriety: 1 }
    default:
      return {}
  }
}

export function pickLine(type, vars = {}, driver = null, rng = Math.random) {
  const own = driver?.lines?.[type]
  const pool = own?.length ? own : drivers.lines[type] || ['…']
  const line = pool[Math.floor(rng() * pool.length)]
  return line.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? Number(vars[k]).toLocaleString('en-NG') : ''))
}

/** A random everyday driver (named, with a personality). */
export function randomDriver(kind, rng = Math.random) {
  const name = drivers.names[Math.floor(rng() * drivers.names.length)]
  const label = kind === 'keke' ? name.replace('Driver', 'Keke') : kind === 'okada' ? name.replace('Driver', 'Okada') : name
  return { id: null, name: label, kind, tolerance: 0.9 + rng() * 0.6, stingy: rng() * 0.8 }
}

export function namedDriver(id) {
  const d = drivers.named[id]
  return d ? { id, ...d } : null
}
