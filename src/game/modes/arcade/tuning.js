// Difficulty that rises with the story, and ad power-ups that take the edge off.
// tuneParams(id, params, level, boosts) turns the story level (0..1) and the
// power-ups bought for this run into the settings each game already reads.
// Early chapters are gentler than the written numbers, the last chapters a
// little harder, and every setting stays inside what a person can do.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const lerp = (a, b, t) => a + (b - a) * t
const ease = (L) => lerp(0.85, 1.2, L) // targets and counts
const quick = (L) => lerp(1.2, 0.85, L) // patience and time per item

/** The ad power-ups for each game: what they're called and what they change. */
export const ARCADE_BOOSTS = {
  change: [
    { id: 'chg_patience', name: 'Patient Passengers', text: 'Everyone waits 40% longer', icon: 'people', apply: (p) => ({ patienceMul: (p.patienceMul ?? 1) * 1.4 }) },
    { id: 'chg_time', name: 'Slow Traffic', text: '20 more seconds at the stop', icon: 'bus', apply: (p) => ({ seconds: (p.seconds ?? 60) + 20 }) },
  ],
  draughts: [{ id: 'dr_tired', name: 'Sleepy Opponent', text: 'He plays a lot worse', icon: 'star', apply: (p) => ({ skill: Math.max(0.15, (p.skill ?? 0.7) - 0.3) }) }],
  traffic: [
    { id: 'tr_room', name: 'Wide Roads', text: 'Queues can grow to 11 cars', icon: 'wheel', apply: () => ({ maxQueue: 11 }) },
    { id: 'tr_calm', name: 'Quiet Hour', text: 'Cars arrive 25% slower', icon: 'bus', apply: (p) => ({ spawnMul: (p.spawnMul ?? 1) * 0.75 }) },
  ],
  ayo: [{ id: 'ayo_tired', name: 'Palm Wine for Him', text: 'He plays a lot worse', icon: 'star', apply: (p) => ({ skill: Math.max(0.15, (p.skill ?? 0.6) - 0.3) }) }],
  palmClimb: [
    { id: 'pc_gloves', name: 'Thick Gloves', text: 'Five stings before you slip', icon: 'shield', apply: () => ({ stingMax: 5 }) },
    { id: 'pc_time', name: 'Early Start', text: '20 more seconds', icon: 'up', apply: (p) => ({ seconds: (p.seconds ?? 45) + 20 }) },
  ],
  fakeParts: [
    { id: 'fp_slow', name: 'Slow Customers', text: '50% longer per box', icon: 'people', apply: (p) => ({ timeMul: (p.timeMul ?? 1) * 1.5 }) },
    { id: 'fp_easy', name: 'Kind Teacher', text: 'Three fewer boxes needed', icon: 'shield', apply: (p) => ({ need: Math.max(8, (p.need ?? 15) - 3) }) },
  ],
  akara: [
    { id: 'ak_cool', name: 'Gentle Fire', text: 'Akara cooks 25% slower: easier to catch golden', icon: 'gas', apply: (p) => ({ cookMul: (p.cookMul ?? 1) * 0.75 }) },
    { id: 'ak_time', name: 'Early Start', text: '20 more seconds', icon: 'gas', apply: (p) => ({ seconds: (p.seconds ?? 70) + 20 }) },
  ],
  sneak: [
    { id: 'sn_life', name: 'Friendly Porter', text: 'Two more tries', icon: 'door', apply: (p) => ({ lives: (p.lives ?? 3) + 2 }) },
    { id: 'sn_slow', name: 'Sleepy Guards', text: 'Guards walk 30% slower', icon: 'run', apply: (p) => ({ tickMul: (p.tickMul ?? 1) * 1.3 }) },
  ],
  penalty: [
    { id: 'pen_foot', name: 'Steady Foot', text: 'The power bar moves 30% slower', icon: 'boot', apply: (p) => ({ powerMul: (p.powerMul ?? 1) * 0.7 }) },
    { id: 'pen_keeper', name: 'Nervous Kickers', text: 'They shoot worse', icon: 'shield', apply: (p) => ({ skill: Math.max(0.1, (p.skill ?? 0.5) - 0.3) }) },
  ],
  posters: [
    { id: 'po_bucket', name: 'Big Bucket', text: '10 scoops of paste', icon: 'megaphone', apply: () => ({ paste: 10 }) },
    { id: 'po_slow', name: 'Lazy Boys', text: 'Their boys come 30% less often', icon: 'people', apply: (p) => ({ spawnMul: (p.spawnMul ?? 1) * 0.7 }) },
  ],
  ballots: [
    { id: 'bal_slow', name: 'Patient Officer', text: '40% longer per ballot', icon: 'stats', apply: (p) => ({ timeMul: (p.timeMul ?? 1) * 1.4 }) },
    { id: 'bal_easy', name: 'Friendly Agents', text: 'Pass with 75% right', icon: 'shield', apply: () => ({ need: 0.75 }) },
  ],
  riceQueue: [
    { id: 'rq_calm', name: 'Cold Water for All', text: 'The crowd gets angry 40% slower', icon: 'people', apply: (p) => ({ angerMul: (p.angerMul ?? 1) * 0.6 }) },
    { id: 'rq_time', name: 'Extra Bags', text: '20 more seconds and 10 more bags', icon: 'naira', apply: (p) => ({ seconds: (p.seconds ?? 75) + 20, bags: (p.bags ?? 40) + 10 }) },
  ],
  pepperSoup: [
    { id: 'ps_patience', name: 'Hungry but Patient', text: 'Customers wait 40% longer', icon: 'people', apply: (p) => ({ patienceMul: (p.patienceMul ?? 1) * 1.4 }) },
    { id: 'ps_time', name: 'Early Start', text: '20 more seconds', icon: 'gas', apply: (p) => ({ seconds: (p.seconds ?? 75) + 20 }) },
  ],
  barRush: [
    { id: 'br_patience', name: 'Happy Hour', text: 'Customers wait 40% longer', icon: 'people', apply: (p) => ({ patienceMul: (p.patienceMul ?? 1) * 1.4 }) },
    { id: 'br_time', name: 'Late Licence', text: '20 more seconds', icon: 'naira', apply: (p) => ({ seconds: (p.seconds ?? 60) + 20 }) },
  ],
  whot: [
    { id: 'wh_tired', name: 'Bassey Is Tired', text: 'He plays a lot worse', icon: 'star', apply: (p) => ({ skill: Math.max(0.15, (p.skill ?? 0.6) - 0.3) }) },
    { id: 'wh_whot', name: 'Lucky Hand', text: 'Start with a Whot card', icon: 'star', apply: () => ({ startWhot: true }) },
  ],
  dance: [
    { id: 'dn_slow', name: 'Slow Jam', text: 'The beat is 15% slower', icon: 'music', apply: (p) => ({ bpm: Math.round((p.bpm ?? 100) * 0.85) }) },
    { id: 'dn_wide', name: 'Good Ears', text: 'Timing is 50% more forgiving', icon: 'music', apply: (p) => ({ windows: (p.windows ?? 1) * 1.5 }) },
  ],
  escape: [
    { id: 'esc_life', name: 'Nine Lives', text: 'Two more lives', icon: 'run', apply: (p) => ({ lives: (p.lives ?? 3) + 2 }) },
    { id: 'esc_tough', name: 'Thick Skin', text: 'Seven hearts instead of five', icon: 'shield', apply: () => ({ hp: 7 }) },
    { id: 'esc_quiet', name: 'Quiet Feet', text: 'Officers see 35% less far', icon: 'dodge', apply: (p) => ({ sightMul: (p.sightMul ?? 1) * 0.65 }) },
  ],
}

/** Settings for one run of a game, from what the story asked, how far in the story you are, and the power-ups. */
export function tuneParams(id, params = {}, level = 0, boosts = []) {
  const L = clamp(level ?? 0, 0, 1)
  const p = { ...params, level: L }
  const n = (v, d) => (v ?? d)
  switch (id) {
    case 'change':
      p.target = Math.round(n(params.target, 8) * ease(L))
      p.patienceMul = quick(L)
      break
    case 'draughts':
      p.skill = clamp(n(params.skill, 0.6) + (L - 0.4) * 0.35, 0.3, 0.9)
      break
    case 'traffic':
      p.target = Math.round(n(params.target, 30) * ease(L))
      p.spawnMul = lerp(0.85, 1.15, L)
      break
    case 'ayo':
      p.skill = clamp(n(params.skill, 0.55) + (L - 0.4) * 0.35, 0.3, 0.9)
      break
    case 'palmClimb':
      p.height = Math.round(n(params.height, 32) * ease(L))
      p.hazard = lerp(0.5, 0.7, L)
      break
    case 'fakeParts':
      p.timeMul = quick(L)
      p.need = Math.round(n(params.need, 15) * lerp(0.9, 1.07, L))
      break
    case 'akara':
      p.target = Math.round(n(params.target, 5) * ease(L))
      p.cookMul = lerp(0.9, 1.15, L)
      break
    case 'sneak':
      p.tickMul = quick(L)
      break
    case 'penalty':
      p.skill = clamp(n(params.skill, 0.5) + (L - 0.4) * 0.35, 0.25, 0.85)
      p.powerMul = lerp(0.9, 1.15, L)
      break
    case 'posters':
      p.spawnMul = lerp(0.85, 1.2, L)
      break
    case 'ballots':
      p.timeMul = quick(L)
      p.need = clamp(n(params.need, 0.85) + (L - 0.5) * 0.08, 0.75, 0.9)
      break
    case 'riceQueue':
      p.need = Math.round(n(params.need, 18) * ease(L))
      p.angerMul = lerp(0.85, 1.15, L)
      break
    case 'pepperSoup':
      p.target = Math.round(n(params.target, 6) * ease(L))
      p.patienceMul = quick(L)
      break
    case 'barRush':
      p.target = Math.round((n(params.target, 20000) * ease(L)) / 500) * 500
      p.patienceMul = quick(L)
      break
    case 'whot':
      p.skill = clamp(n(params.skill, 0.6) + (L - 0.4) * 0.35, 0.3, 0.9)
      break
    case 'dance':
      p.skill = clamp(n(params.skill, 0.55) + (L - 0.4) * 0.3, 0.3, 0.85)
      p.bpm = Math.round(n(params.bpm, 100) * lerp(0.92, 1.08, L))
      break
    case 'escape':
      p.difficulty = clamp(n(params.difficulty, 1) + L * 0.8, 1, 3.5)
      break
    default:
      break
  }
  for (const b of ARCADE_BOOSTS[id] || []) if (boosts.includes(b.id)) Object.assign(p, b.apply(p))
  return p
}
