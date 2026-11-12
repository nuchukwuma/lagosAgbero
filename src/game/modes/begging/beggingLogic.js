// Aggressive begging in Zone 5 Estate (pure). A run is a queue of targets,
// each described by a hint. The player reads the hint and picks an approach.
// Matching the approach to the target pays; aggression angers the estate.
// One target may be "the wrong person": anything but letting him pass ends
// the run with outcome "wrongPerson" (the story takes it from there).
// Estate anger 100 = security chases you out (outcome "chased").

import data from '../../data/jobs.json'

export const BEG = data.begging
const KINDS = Object.keys(BEG.targets)

function rngFrom(seed) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

export function createBegRun({ seed = 1, count = 6, wrongPerson = null, wrongAt = 3, goodwill = 10 } = {}) {
  const rng = rngFrom(seed)
  const targets = []
  for (let i = 0; i < count; i++) {
    if (wrongPerson && i === wrongAt && BEG.wrong[wrongPerson]) {
      const w = BEG.wrong[wrongPerson]
      targets.push({ kind: wrongPerson, wrong: true, name: w.name, hint: w.hints[Math.floor(rng() * w.hints.length)] })
      continue
    }
    const kind = KINDS[Math.floor(rng() * KINDS.length)]
    const t = BEG.targets[kind]
    targets.push({ kind, name: t.name, hint: t.hints[Math.floor(rng() * t.hints.length)] })
  }
  return { rng, targets, index: 0, collected: 0, anger: 0, aggressive: 0, goodwill, log: [], over: null }
}

export const currentTarget = (r) => r.targets[r.index]

/** Apply an approach to the current target. Returns { gain, outcome }. */
export function approach(r, how) {
  const t = currentTarget(r)
  if (!t || r.over) return { gain: 0, outcome: 'none' }
  let gain = 0
  let outcome = 'ignored'
  if (t.wrong) {
    if (how === 'skip') outcome = 'dodged'
    else {
      r.over = 'wrongPerson'
      r.wrongWith = how
      r.log.push(`wrong:${t.kind}`)
      return { gain: 0, outcome: 'wrongPerson' }
    }
  } else {
    const def = BEG.targets[t.kind]
    const mult = def.pay[how] ?? 0
    // goodwill makes people more generous, a little
    const luck = 0.7 + r.rng() * 0.6 + Math.min(0.3, r.goodwill / 200)
    gain = Math.round((def.base * mult * luck) / 50) * 50
    r.anger = Math.min(100, r.anger + (def.anger[how] || 0))
    if (how === 'block') r.aggressive++
    outcome = how === 'skip' ? 'skipped' : gain > 0 ? (mult >= 1.2 ? 'great' : 'some') : 'nothing'
    if (outcome === 'nothing' && how !== 'skip') r.anger = Math.min(100, r.anger + 5)
    r.collected += gain
  }
  r.index++
  if (r.anger >= 100) r.over = 'chased'
  else if (r.index >= r.targets.length) r.over = 'done'
  return { gain, outcome }
}

export function begResult(r) {
  return {
    outcome: r.over || 'done',
    moneyChange: r.over === 'chased' ? Math.round(r.collected / 2) : r.collected,
    stats: { communityGoodwill: -Math.min(4, r.aggressive), notoriety: r.aggressive, energy: -6 },
    flags: ['begged'],
  }
}
