// Haggling at a stall (pure). Customers come one by one for your goods. You
// name a price; each customer has a top price they keep to themselves:
//   at or under it  -> they pay
//   over it         -> they counter (a little under their top); take it, or
//                      push again and they lose patience; at no patience they walk
// Read the hints ("she's checking her purse", "he came in a car") to guess.
// The day's takings are the result.

export const GOODS = {
  yams: { name: 'yams', unit: 'tuber', fair: 1800, seller: 'Nkwọ market' },
  palmwine: { name: 'palm wine', unit: 'keg', fair: 2500, seller: 'the palm-wine shade' },
  notes: { name: 'lecture notes', unit: 'set', fair: 1500, seller: 'the cafeteria' },
  jollof: { name: 'jollof', unit: 'plate', fair: 1200, seller: 'the canteen' },
  drinks: { name: 'drinks', unit: 'crate', fair: 9000, seller: 'the Sugar Palace bar' },
  favours: { name: 'promises', unit: 'favour', fair: 25000, seller: 'the fundraiser' }, // The Honourable: donors buy "considerations"
  pap: { name: 'pap and akara', unit: 'wrap', fair: 500, seller: "Mama Somto's stall" }, // Fake It Till You Graduate
  parts: { name: 'spare parts', unit: 'part', fair: 6000, seller: "Ike's shop at Ọjà" }, // Grass to Grace
}

const BUYERS = [
  { kind: 'rich', k: [1.35, 1.7], patience: 3, hints: ['came in a car with tinted glass', 'is wearing real gold, not "Lagos gold"', 'is on the phone saying "just pay them"'] },
  { kind: 'normal', k: [0.95, 1.25], patience: 2, hints: ['looks like a teacher on payday', 'is buying for a party', 'knows the price but likes your face'] },
  { kind: 'tight', k: [0.75, 0.95], patience: 1, hints: ['is counting coins', 'already said "last price" twice to the next stall', 'has three children pulling her wrapper'] },
]

function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 233280 || 1
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

export function createHaggle({ goods = 'yams', customers = 6, seed = 1, charm = 0 } = {}) {
  const g = GOODS[goods] || GOODS.yams
  const r = rng(seed)
  const queue = Array.from({ length: customers }, () => {
    const b = BUYERS[Math.floor(r() * BUYERS.length)]
    const k = b.k[0] + r() * (b.k[1] - b.k[0]) + charm * 0.02
    return { kind: b.kind, top: Math.round((g.fair * k) / 50) * 50, patience: b.patience, hint: b.hints[Math.floor(r() * b.hints.length)], counter: null }
  })
  return { goods: g, queue, index: 0, takings: 0, sold: 0, walked: 0, log: [], over: false }
}

export const current = (h) => (h.over ? null : h.queue[h.index])

function next(h) {
  h.index++
  if (h.index >= h.queue.length) h.over = true
}

/** Ask a price. Returns what happened: { result: 'sold'|'counter'|'walked', price } */
export function ask(h, price) {
  const c = current(h)
  if (!c) return null
  price = Math.max(50, Math.round(price / 50) * 50)
  if (price <= c.top) {
    h.takings += price
    h.sold++
    h.log.push({ result: 'sold', price })
    next(h)
    return { result: 'sold', price }
  }
  if (c.patience <= 0) {
    h.walked++
    h.log.push({ result: 'walked' })
    next(h)
    return { result: 'walked' }
  }
  c.patience--
  // their counter creeps up towards their top, never past it
  c.counter = Math.round(Math.min(c.top, Math.max(c.counter ?? c.top * 0.8, c.top * (0.85 + (2 - c.patience) * 0.05))) / 50) * 50
  h.log.push({ result: 'counter', price: c.counter })
  return { result: 'counter', price: c.counter }
}

/** Take the customer's counter offer. */
export function acceptCounter(h) {
  const c = current(h)
  if (!c?.counter) return null
  return ask(h, c.counter)
}

/** The story-facing result. */
export function haggleResult(h) {
  const outcome = h.sold >= Math.ceil(h.queue.length * 0.6) ? 'good' : h.sold > 0 ? 'ok' : 'bad'
  return { outcome, moneyChange: h.takings, sold: h.sold, walked: h.walked }
}
