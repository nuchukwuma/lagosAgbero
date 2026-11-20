// What this player has already seen and done, kept on the device:
//   - the how-to-play intros of the fight and the run show once; after that
//     the intro shows your record (best run, fights won) and the power-ups
//   - fight records: won, lost, best combo
//   - practice per game (plays, wins): harder, and better paid, the more you play
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

// ---- practice: every game gets harder the more you play it, and pays more
/** How often you've played and won a game (mini-games and story modes alike). */
export const practice = (id) => ({ plays: 0, wins: 0, ...(read().practice?.[id] || {}) })
export function recordPlay(id, won) {
  const r = read()
  const p = practice(id)
  p.plays++
  if (won) p.wins++
  write({ ...r, practice: { ...(r.practice || {}), [id]: p } })
  return p
}
/** How much harder practice makes a game: up to +0.35 on the 0-1 difficulty scale. */
export function practiceBump(id) {
  const { plays, wins } = practice(id)
  return Math.min(0.35, plays * 0.02 + wins * 0.04)
}
/** What the game pays, as a multiple: more later in the story and the more you've won it (1 to 2.2). */
export function rewardMulFor(id, storyLevel = 0) {
  const { wins } = practice(id)
  return Math.round((1 + 0.6 * Math.max(0, Math.min(1, storyLevel)) + Math.min(0.6, wins * 0.06)) * 20) / 20
}

/** Forget everything (for tests). */
export const resetRecords = () => write({})
