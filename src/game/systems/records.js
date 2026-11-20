// What this player has already seen and done, kept on the device:
//   - the how-to-play intros of the fight and the run show once; after that
//     the intro shows your record (best run, fights won) and the power-ups
//   - fight records: won, lost, best combo
// Like the other saved keys, it uses the old "areaBoy." prefix.

const KEY = 'areaBoy.records'

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}
function write(r) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // storage blocked: records last for this session only
  }
}

/** Has the player seen this how-to-play intro before? */
export const seenIntro = (id) => Boolean(read().seen?.[id])
export function markIntroSeen(id) {
  const r = read()
  write({ ...r, seen: { ...(r.seen || {}), [id]: true } })
}

export const fightRecord = () => ({ won: 0, lost: 0, bestCombo: 0, ...(read().fight || {}) })
export function recordFight({ outcome, combo = 0 }) {
  const r = read()
  const f = { won: 0, lost: 0, bestCombo: 0, ...(r.fight || {}) }
  if (outcome === 'won') f.won++
  else if (outcome === 'lost') f.lost++
  f.bestCombo = Math.max(f.bestCombo, combo)
  write({ ...r, fight: f })
  return f
}

/** Best score in a mini-game (arcade games and the like). */
export const bestScore = (id) => read().best?.[id] || 0
export function recordScore(id, score) {
  const r = read()
  const best = Math.max(r.best?.[id] || 0, Math.round(score) || 0)
  write({ ...r, best: { ...(r.best || {}), [id]: best } })
  return best
}

/** Forget everything (for tests). */
export const resetRecords = () => write({})
