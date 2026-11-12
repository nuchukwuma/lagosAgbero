// Settlement's rally jobs (pure). Six rounds at the Roundabout. Each round the
// player picks an action; then a random crowd event happens. Disruption must
// reach the job's goal; heat (cameras, police) must stay under 100.
// Outcomes: paid | faked | failed | arrested | brawl

import data from '../../data/jobs.json'

export const RALLY = data.rally

function rngFrom(seed) {
  let s = seed
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}

export function createRally({ job = 'disturb', seed = 1, help = 0 } = {}) {
  const j = RALLY.jobs[job] || RALLY.jobs.disturb
  return { job: j, rng: rngFrom(seed), round: 0, disruption: 0, heat: 0, rice: j.rice, fakes: 0, help, over: null, log: [] }
}

export function canUse(r, action) {
  const a = RALLY.actions[action]
  if (!a) return false
  if (a.uses === 'rice') return r.rice > 0
  return true
}

/** One round: the player's action, then a crowd event. Returns { event, brawl }. */
export function playRound(r, action) {
  if (r.over) return { event: null }
  const a = RALLY.actions[action]
  if (!a || !canUse(r, action)) return { event: null }
  if (a.uses === 'rice') r.rice--
  if (a.fake) r.fakes++
  r.disruption = Math.min(100, r.disruption + a.disruption + r.help)
  r.heat = Math.max(0, Math.min(100, r.heat + a.heat))
  if (a.brawlChance && r.rng() < a.brawlChance) {
    r.over = 'brawl'
    return { event: 'Their thugs grab you by the singlet!', brawl: true }
  }
  const ev = RALLY.events[Math.floor(r.rng() * RALLY.events.length)]
  r.disruption = Math.min(100, r.disruption + (ev.disruption || 0))
  r.heat = Math.min(100, r.heat + (ev.heat || 0) * (a.fake ? 0.3 : 1))
  if (ev.brawlChance && !a.fake && r.rng() < ev.brawlChance) {
    r.over = 'brawl'
    return { event: ev.text, brawl: true }
  }
  r.round++
  if (r.heat >= 100) r.over = 'arrested'
  else if (r.round >= r.job.rounds) r.over = r.disruption >= r.job.goal ? 'paid' : r.fakes >= r.job.rounds - 1 ? 'faked' : 'failed'
  return { event: ev.text }
}

export function rallyResult(r) {
  const pay = r.job.pay
  const money = { paid: pay, faked: Math.round(pay * 0.5), failed: Math.round(pay * 0.2), arrested: 0, brawl: Math.round(pay * 0.3) }[r.over] ?? 0
  return {
    outcome: r.over,
    moneyChange: money,
    stats: { notoriety: r.over === 'paid' ? 5 : r.over === 'brawl' ? 4 : 1, policeHeat: Math.round(r.heat / 10), energy: -10 },
    flags: [`rally_${r.over}`],
  }
}
