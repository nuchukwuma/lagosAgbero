// Bus conductor rules (pure). The danfo goes stop to stop. At each stop:
//   1. drop off  — pick who gets off (passengers said their stop when boarding)
//   2. call      — shout the right route so the right people board
//   3. fares     — give the right change to each new passenger
// Mistakes raise the bus's anger. Angry passengers refuse to pay; at 100 a
// brawl breaks out (the mode ends with outcome "brawl").
// The driver keeps 70% of fares; the conductor (you) keeps 30% plus tips.

import data from '../../data/routes.json'

export const ROUTES = data.routes
export const NAMED = data.named
export const CONDUCTOR_SHARE = 0.3
const NOTES = [200, 500, 1000]

function rngFrom(seed) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

export function createTrip({ route = 'oshodi', seed = 1, named = [], extortionAt = null, difficulty = 1 } = {}) {
  const r = ROUTES[route] || ROUTES.oshodi
  return {
    route: r,
    rng: rngFrom(seed),
    stopIndex: 0,
    passengers: [], // { id, name, dest, quirk, paid }
    anger: 0,
    fares: 0,
    lost: 0,
    tips: 0,
    named: named.map((id) => ({ id, ...NAMED[id] })).filter((n) => n.name),
    extortionAt,
    difficulty,
    log: [],
    over: null,
    nextId: 1,
  }
}

export const isLastStop = (t) => t.stopIndex >= t.route.stops.length - 1
export const stopName = (t) => t.route.stops[t.stopIndex]

/** Step 1: who gets off here. `chosen` = ids the player drops. */
export function dropOff(t, chosen) {
  const here = t.stopIndex
  const set = new Set(chosen)
  const result = { correct: 0, missed: 0, wrong: 0 }
  t.passengers = t.passengers.filter((p) => {
    const shouldGo = p.dest === here || (isLastStop(t) && true)
    const dropped = set.has(p.id)
    if (shouldGo && dropped) result.correct++
    else if (shouldGo && !dropped) {
      if (p.dest < here || isLastStop(t)) return false
      result.missed++
      p.dest = here + 1 // they get off at the next stop, furious
      return true
    } else if (!shouldGo && dropped) result.wrong++
    return !dropped
  })
  t.anger = Math.min(100, Math.max(0, t.anger + result.missed * 15 + result.wrong * 20 - result.correct * 3))
  if (result.missed) t.log.push('angryMissed')
  if (result.wrong) t.log.push('angryWrongDrop')
  return result
}

/** Step 2: the call. Returns the passengers who board (not yet paid). */
export function callRoute(t, correct) {
  const rnd = t.rng
  const remaining = t.route.stops.length - 1 - t.stopIndex
  if (remaining <= 0) return []
  const count = correct ? 2 + Math.floor(rnd() * 2) : 1
  const boarding = []
  for (let i = 0; i < count; i++) {
    const dest = t.stopIndex + 1 + Math.floor(rnd() * remaining)
    boarding.push({ id: t.nextId++, name: data.passengerNames[Math.floor(rnd() * data.passengerNames.length)], dest, quirk: correct ? null : 'wrongBus', paid: false })
  }
  for (const n of t.named) if (n.boardAt === t.stopIndex && !n.boarded) {
    n.boarded = true
    boarding.push({ id: t.nextId++, name: n.name, dest: Math.min(t.route.stops.length - 1, t.stopIndex + 2), quirk: n.quirk, line: n.line, paid: false })
  }
  if (!correct) t.anger = Math.min(100, t.anger + 12)
  t.passengers.push(...boarding)
  return boarding
}

/** What a passenger hands over for the fare. */
export function paymentFor(t, p) {
  const fare = t.route.fare
  if (p.quirk === 'exact') return fare
  const options = NOTES.filter((n) => n >= fare)
  return options[Math.floor(t.rng() * options.length)]
}

/** Three change options, one correct, shuffled. */
export function changeOptions(t, given) {
  const right = given - t.route.fare
  const set = new Set([right, Math.max(0, right - 100), right + 100, Math.max(0, right - 200)])
  const opts = [...set].slice(0, 3)
  if (!opts.includes(right)) opts[0] = right
  return opts.sort(() => t.rng() - 0.5)
}

/** Step 3: settle one fare. choice: change given | 'accept' | 'refuseQuirk' */
export function settleFare(t, p, given, change) {
  const fare = t.route.fare
  const refuseChance = t.anger / 140
  if (p.quirk === 'wrongBus') {
    t.anger = Math.min(100, t.anger + 8)
    p.paid = true
    return { outcome: 'wrongBus' }
  }
  if (t.rng() < refuseChance) {
    p.paid = true
    t.log.push('refuse')
    return { outcome: 'refused' }
  }
  const right = given - fare
  p.paid = true
  if (change === right) {
    t.fares += fare
    t.anger = Math.max(0, t.anger - 2)
    return { outcome: 'ok' }
  }
  if (change < right) {
    t.fares += given - change
    t.anger = Math.min(100, t.anger + 12)
    t.log.push('angryShort')
    return { outcome: 'short' }
  }
  t.fares += given - change
  t.lost += change - right
  return { outcome: 'over' }
}

/** Quirky passengers. accept=true trusts them. */
export function settleQuirk(t, p, accept) {
  p.paid = true
  if (p.quirk === 'transfer') {
    if (!accept) {
      t.anger = Math.min(100, t.anger + 5)
      return { outcome: 'refusedTransfer' }
    }
    const real = t.rng() < 0.4
    if (real) t.fares += t.route.fare
    return { outcome: real ? 'transferArrived' : 'transferNeverCame' }
  }
  if (p.quirk === 'prophecy') {
    if (accept) {
      t.tips += 0
      return { outcome: 'prophecy' }
    }
    t.fares += t.route.fare
    return { outcome: 'prophetPaid' }
  }
  return { outcome: 'ok' }
}

/** Move to the next stop; returns 'brawl' / 'done' / null. */
export function nextStop(t) {
  if (t.anger >= 100) return (t.over = 'brawl')
  if (isLastStop(t)) return (t.over = 'done')
  t.stopIndex++
  // happy buses tip
  if (t.anger < 20 && t.passengers.length) t.tips += 50 * t.passengers.length
  return null
}

export function conductorPay(t) {
  return Math.round(t.fares * CONDUCTOR_SHARE + t.tips - t.lost)
}
