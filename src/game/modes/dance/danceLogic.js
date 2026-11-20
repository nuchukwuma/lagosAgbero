// Dance battle rules (pure). Each round the rival dances a routine of moves
// on the beat; then it's your turn: repeat the routine, one move a beat. A
// move on time scores (perfect / good); the wrong move, an off-beat tap or a
// missed beat scores nothing and cools the crowd. The rival's own score comes
// from their skill. Three rounds, each routine longer; the bigger total wins.
//
// Time is in beats from the start of the battle (the screen turns seconds into
// beats with the tempo), so the rules don't care how fast the music is.

export const MOVES = {
  shaku: { name: 'Shaku Shaku', color: '#e74c3c' },
  zanku: { name: 'Zanku', color: '#2e86de' },
  gwara: { name: 'Gwara Gwara', color: '#27ae60' },
  shoki: { name: 'Shoki', color: '#f39c12' },
  azonto: { name: 'Azonto', color: '#8e44ad' },
}
export const MOVE_IDS = Object.keys(MOVES)
export const PERFECT = 0.18 // beats either side
export const GOOD = 0.36
const LEAD = 4 // beats of count-in before each routine

function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 233280 || 1
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

export function createBattle({ rounds = 3, length = 4, skill = 0.6, seed = 1 } = {}) {
  const r = rng(seed)
  const plan = []
  let beat = 0
  for (let i = 0; i < rounds; i++) {
    const n = length + i
    const moves = Array.from({ length: n }, () => MOVE_IDS[Math.floor(r() * MOVE_IDS.length)])
    const rivalAt = beat + LEAD // the rival dances these beats
    const youAt = rivalAt + n + 2 // then a two-beat breath, then you
    plan.push({ moves, rivalAt, youAt })
    beat = youAt + n
  }
  // the rival's marks: each move perfect, good or a stumble, by skill
  const rivalMarks = plan.map((p) => p.moves.map(() => (r() < skill ? 'perfect' : r() < 0.6 ? 'good' : 'miss')))
  return { plan, end: beat + 2, rivalMarks, marks: plan.map((p) => p.moves.map(() => null)), you: 0, rival: 0, hype: 0.3, over: false }
}

const POINTS = { perfect: 3, good: 2, miss: 0 }

/** Where we are at beat t: { round, phase: 'count'|'rival'|'you'|'done', step } */
export function phaseAt(b, t) {
  for (let i = 0; i < b.plan.length; i++) {
    const p = b.plan[i]
    const n = p.moves.length
    if (t < p.rivalAt - 0.5) return { round: i, phase: 'count', step: -1 }
    if (t < p.rivalAt + n - 0.5) return { round: i, phase: 'rival', step: Math.round(t - p.rivalAt) }
    if (t < p.youAt - 0.5) return { round: i, phase: 'count', step: -1 }
    if (t < p.youAt + n - 0.5) return { round: i, phase: 'you', step: Math.round(t - p.youAt) }
  }
  return { round: b.plan.length - 1, phase: 'done', step: -1 }
}

/** The player taps a move at beat t. Returns the mark it earned (or null if it wasn't their turn). */
export function tap(b, t, move) {
  const ph = phaseAt(b, t)
  if (ph.phase !== 'you') return null
  const p = b.plan[ph.round]
  const step = ph.step
  if (b.marks[ph.round][step]) return null // already danced this beat
  const off = Math.abs(t - (p.youAt + step))
  const mark = move !== p.moves[step] ? 'miss' : off <= PERFECT ? 'perfect' : off <= GOOD ? 'good' : 'miss'
  b.marks[ph.round][step] = mark
  b.you += POINTS[mark]
  b.hype = Math.max(0, Math.min(1, b.hype + (mark === 'miss' ? -0.12 : mark === 'perfect' ? 0.1 : 0.05)))
  return { mark, move, expected: p.moves[step] }
}

/** Move the battle on to beat t: beats you let pass are misses; the rival's marks count as they dance. */
export function advanceTo(b, t) {
  for (let i = 0; i < b.plan.length; i++) {
    const p = b.plan[i]
    p.moves.forEach((_, step) => {
      if (!b.marks[i][step] && t > p.youAt + step + GOOD + 0.05) {
        b.marks[i][step] = 'miss'
        b.hype = Math.max(0, b.hype - 0.08)
      }
      if (!p.counted?.[step] && t > p.rivalAt + step) {
        p.counted = { ...(p.counted || {}), [step]: true }
        b.rival += POINTS[b.rivalMarks[i][step]]
      }
    })
  }
  if (t >= b.end) b.over = true
  return b
}

export function battleResult(b) {
  return { outcome: b.you >= b.rival ? 'won' : 'lost', you: b.you, rival: b.rival }
}
