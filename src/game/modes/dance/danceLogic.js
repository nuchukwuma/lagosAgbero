// Dance battle rules (pure): a 4-lane rhythm battle. Arrows (left, down, up,
// right) fall towards the line; tap the lane as an arrow reaches it. On the
// beat is PERFECT, a little off is GOOD, missing it breaks your combo and
// cools the crowd. The rival dances a phrase first (their arrows are danced
// for them, with their skill), then it's your turn; each round the phrases
// get busier. Every arrow is a dance move, so your dancer dances what you hit.
// Bigger total wins.
//
// Time is in beats from the start (the screen turns seconds into beats with
// the tempo), so the rules don't care how fast the music is.

export const LANES = [
  { id: 'left', arrow: '←', move: 'shaku', name: 'Shaku', color: '#e74c3c' },
  { id: 'down', arrow: '↓', move: 'gwara', name: 'Gwara', color: '#27ae60' },
  { id: 'up', arrow: '↑', move: 'zanku', name: 'Zanku', color: '#2e86de' },
  { id: 'right', arrow: '→', move: 'azonto', name: 'Azonto', color: '#8e44ad' },
]
// the moves, for the dancers (the five dances the pixel dancers know)
export const MOVES = {
  shaku: { name: 'Shaku Shaku', color: '#e74c3c' },
  zanku: { name: 'Zanku', color: '#2e86de' },
  gwara: { name: 'Gwara Gwara', color: '#27ae60' },
  shoki: { name: 'Shoki', color: '#f39c12' },
  azonto: { name: 'Azonto', color: '#8e44ad' },
}
export const MOVE_IDS = Object.keys(MOVES)
export const PERFECT = 0.13 // beats either side
export const GOOD = 0.28
const LEAD = 4 // beats of count-in before each phrase
const POINTS = { perfect: 3, good: 2, miss: 0 }

function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 233280 || 1
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

/**
 * One phrase of arrows over `beats` beats, starting at `at`. density 0..1:
 * how many off-beats (eighths) and double arrows it has.
 */
function phrase(r, at, beats, density) {
  const notes = []
  let lastLane = -1
  for (let b = 0; b < beats; b += 0.5) {
    const onBeat = b % 1 === 0
    if (!onBeat && r() > density * 0.75) continue // off-beats get commoner as it gets harder
    if (onBeat && b % 4 === 3 && r() < 0.35) continue // breathing space
    let lane = Math.floor(r() * 4)
    if (lane === lastLane && r() < 0.6) lane = (lane + 1 + Math.floor(r() * 3)) % 4
    notes.push({ lane, beat: at + b })
    if (onBeat && density > 0.45 && r() < (density - 0.45) * 0.5) notes.push({ lane: (lane + 2) % 4, beat: at + b }) // a double
    lastLane = lane
  }
  return notes
}

/**
 * rounds (3) · length (beats in the first phrase, 8; later phrases are longer)
 * skill (the rival, 0..1) · level (how hard the arrows are, 0..1) · seed
 */
export function createBattle({ rounds = 3, length = 8, skill = 0.6, level = 0.3, seed = 1 } = {}) {
  const r = rng(seed)
  const plan = []
  const notes = []
  let beat = 0
  for (let i = 0; i < rounds; i++) {
    const beats = length + i * 4
    const density = Math.min(1, level * 0.6 + i * 0.12) // off-beats and doubles creep in round by round
    const rivalAt = beat + LEAD
    const youAt = rivalAt + beats + 2
    for (const n of phrase(r, rivalAt, beats, density)) notes.push({ ...n, who: 'rival', round: i, mark: null })
    for (const n of phrase(r, youAt, beats, density)) notes.push({ ...n, who: 'you', round: i, mark: null })
    plan.push({ rivalAt, youAt, beats })
    beat = youAt + beats
  }
  // the rival's marks, decided by their skill
  for (const n of notes) if (n.who === 'rival') n.rivalMark = r() < skill ? 'perfect' : r() < 0.65 ? 'good' : 'miss'
  return { plan, notes, end: beat + 2, you: 0, rival: 0, combo: 0, best: 0, hype: 0.3, counts: { perfect: 0, good: 0, miss: 0 }, over: false }
}

/**
 * The tempo of a round: the arrows start slow so you get used to them, and each
 * round is a little quicker (72% of the battle's tempo, then 82%, 92%, 100%).
 */
export const roundTempo = (bpm, round) => bpm * Math.min(1, 0.72 + round * 0.1)

/** Which round beat t is in (the count-in before a round belongs to it). */
export function roundAt(b, t) {
  for (let i = 0; i < b.plan.length; i++) if (t < b.plan[i].youAt + b.plan[i].beats) return i
  return b.plan.length - 1
}

/** Where we are at beat t: { round, phase: 'count'|'rival'|'you'|'done' } */
export function phaseAt(b, t) {
  for (let i = 0; i < b.plan.length; i++) {
    const p = b.plan[i]
    if (t < p.rivalAt - 0.5) return { round: i, phase: 'count' }
    if (t < p.rivalAt + p.beats) return { round: i, phase: 'rival' }
    if (t < p.youAt - 0.5) return { round: i, phase: 'count' }
    if (t < p.youAt + p.beats) return { round: i, phase: 'you' }
  }
  return { round: b.plan.length - 1, phase: 'done' }
}

function judge(b, n, mark) {
  n.mark = mark
  b.counts[mark]++
  b.you += POINTS[mark] + (mark !== 'miss' && b.combo >= 10 ? 1 : 0) // a combo bonus
  b.combo = mark === 'miss' ? 0 : b.combo + 1
  b.best = Math.max(b.best, b.combo)
  b.hype = Math.max(0, Math.min(1, b.hype + (mark === 'miss' ? -0.08 : mark === 'perfect' ? 0.04 : 0.02)))
}

/** The player taps a lane at beat t. Returns { mark, lane } for the nearest arrow in that lane, or { mark: 'stray' }. */
export function tap(b, t, lane, windows = 1) {
  let best = null
  for (const n of b.notes) {
    if (n.who !== 'you' || n.mark || n.lane !== lane) continue
    const off = Math.abs(t - n.beat)
    if (off <= GOOD * windows && (!best || off < Math.abs(t - best.beat))) best = n
  }
  if (!best) {
    b.hype = Math.max(0, b.hype - 0.01)
    return { mark: 'stray', lane }
  }
  const off = Math.abs(t - best.beat)
  judge(b, best, off <= PERFECT * windows ? 'perfect' : 'good')
  return { mark: best.mark, lane, note: best }
}

/** Move on to beat t: your arrows that passed the line are misses; the rival's are danced as they arrive. */
export function advanceTo(b, t, windows = 1) {
  for (const n of b.notes) {
    if (n.mark) continue
    if (n.who === 'you' && t > n.beat + GOOD * windows + 0.04) judge(b, n, 'miss')
    if (n.who === 'rival' && t >= n.beat) {
      n.mark = n.rivalMark
      b.rival += POINTS[n.rivalMark]
    }
  }
  if (t >= b.end) b.over = true
  return b
}

export function battleResult(b) {
  return { outcome: b.you >= b.rival ? 'won' : 'lost', you: b.you, rival: b.rival, best: b.best, counts: b.counts }
}
