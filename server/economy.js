// Lagos Online: the street economy's numbers. Sending naira between players,
// what someone is worth, and the three reputations the boards track.
import { SHOP } from '../src/game/online/catalog.js'

export const GIVE_MIN = 100
export const GIVE_MAX = 50000 // in one go
export const GIVE_DAILY = 200000 // sent in a day (so nobody farms daily bonuses through fresh guests)

/** Older saves: the newer stats start at zero. */
export function ensureStats(p) {
  p.stats = { wins: 0, losses: 0, played: 0, betsWon: 0, ...p.stats }
  for (const k of ['respect', 'influence', 'heists', 'given', 'received']) p.stats[k] ??= 0
  return p
}

/** Cash plus what they own (shop items at their price; property comes later). */
export function netWorth(p) {
  let worth = p.money
  for (const [id, have] of Object.entries(p.items || {})) {
    const it = SHOP[id]
    if (!it || !have) continue
    worth += it.kind === 'uses' ? it.price * have : it.price
  }
  return worth
}

/** A player's row on a board. */
export function boardRow(p, extra = {}) {
  return { id: p.id, name: p.name, group: p.group || null, worth: netWorth(p), respect: p.stats.respect || 0, influence: p.stats.influence || 0, heists: p.stats.heists || 0, wins: p.stats.wins || 0, ...extra }
}

/** Is this amount allowed to go from p today? Returns an error, or null. */
export function giveProblem(p, amount, day) {
  if (!Number.isFinite(amount) || amount < GIVE_MIN || amount > GIVE_MAX) return `Send ₦${GIVE_MIN.toLocaleString('en-NG')} to ₦${GIVE_MAX.toLocaleString('en-NG')} at a time.`
  if (amount > p.money) return "You don't have that much."
  const sent = p.sent?.day === day ? p.sent.amount : 0
  if (sent + amount > GIVE_DAILY) return `You can send ₦${GIVE_DAILY.toLocaleString('en-NG')} a day (₦${(GIVE_DAILY - sent).toLocaleString('en-NG')} left today).`
  return null
}
