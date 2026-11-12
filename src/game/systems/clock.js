// The game clock. `game.time` is minutes since midnight (0..1439).
// While the player is on the street, 1 real second = TIME_SCALE game minutes.
// Story scenes with "time": "dawn" | "day" | "dusk" | "night" jump the clock.

export const TIME_SCALE = 4 // game minutes per real second (a 16-hour day ≈ 4 real minutes)
export const TIME_OF = { dawn: 6 * 60, day: 11 * 60, dusk: 18 * 60, night: 21 * 60 }
export const EVENING_AT = 21 * 60 // Baba Ticket comes for his share

export function phaseOf(minutes) {
  const h = ((minutes ?? TIME_OF.dawn) / 60) % 24
  if (h >= 5 && h < 7.5) return 'dawn'
  if (h >= 7.5 && h < 17) return 'day'
  if (h >= 17 && h < 19.5) return 'dusk'
  return 'night'
}

/** "HH:MM" or a phase name -> minutes */
export function parseTime(t) {
  if (typeof t === 'number') return t
  if (TIME_OF[t] != null) return TIME_OF[t]
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/)
  if (!m) throw new Error(`Bad time "${t}". Use "HH:MM" or dawn/day/dusk/night`)
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatClock(minutes) {
  const m = Math.floor(minutes ?? 0) % 1440
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const ampm = h < 12 ? 'a.m.' : 'p.m.'
  return `${((h + 11) % 12) + 1}:${mm} ${ampm}`
}
