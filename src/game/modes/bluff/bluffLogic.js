// Bluff (pure): keep a lie going while someone questions you.
//
// The LEDGER is your story so far: every claim you have made, true or not
// (saved in game memory as lie_<fact>: value). Each answer can:
//   says:  { dad: "oil" }   make a claim (a lie, unless truth: true)
//   risk:  how suspicious the answer sounds on its own
//   truth: true             an honest answer (never contradicts anything)
//   core:  true             the honest answer gives the whole secret away
//   deflect: true           a joke / change of subject (works once or twice)
// If you claim something different from what the ledger says, it's a
// CONTRADICTION: suspicion jumps. If the ledger already has the fact, a
// "stick to your story" option is added, which calms things down.
// Hesitating past the timer counts against you.
//
// Outcomes: convinced | doubted | caught | confessed

import data from '../../data/bluffs.json'

export const SCENARIOS = data.scenarios
export const CAUGHT_AT = 100
const CONTRADICTION = 55

export function createBluff(scenarioId, ledger = {}, { seconds = 9 } = {}) {
  const s = SCENARIOS[scenarioId]
  if (!s) throw new Error(`Unknown bluff "${scenarioId}"`)
  return { id: scenarioId, scenario: s, ledger: { ...ledger }, claims: {}, index: 0, suspicion: s.startSuspicion ?? 0, deflects: 0, seconds, log: [], over: null }
}

export const currentQuestion = (b) => (b.over ? null : b.scenario.questions[b.index])

/** Options for the current question, including "stick to your story" when it applies. */
export function optionsFor(b) {
  const q = currentQuestion(b)
  if (!q) return []
  const opts = q.answers.map((a, i) => ({ ...a, index: i }))
  if (q.fact && b.ledger[q.fact] !== undefined) {
    const known = b.ledger[q.fact]
    const label = data.facts?.[q.fact]?.[known] || known
    opts.unshift({ text: `Stick to your story: "${label}"`, says: { [q.fact]: known }, risk: 0, stick: true, index: -1 })
  }
  return opts
}

/** Answer with an option from optionsFor (or null when time ran out). Returns what happened. */
export function answerBluff(b, option) {
  const q = currentQuestion(b)
  if (!q) return null
  let delta = 0
  let event = 'ok'
  if (!option) {
    delta = 18
    event = 'hesitated'
  } else {
    delta = option.risk ?? 10
    if (option.stick) {
      delta = -8
      event = 'consistent'
    }
    if (option.deflect) {
      b.deflects++
      delta = b.deflects === 1 ? 6 : b.deflects === 2 ? 16 : 30
      event = 'deflected'
    }
    for (const [fact, value] of Object.entries(option.says || {})) {
      const before = b.ledger[fact]
      // saying something different from your earlier story is a
      // contradiction, even when the new thing is the truth
      if (before !== undefined && before !== value) {
        delta += CONTRADICTION
        event = 'contradiction'
      }
      b.claims[fact] = value
      b.ledger[fact] = value
    }
    if (option.truth && event !== 'contradiction') {
      event = option.core ? 'confessed' : 'truth'
      delta = Math.min(delta, 4)
    } else if (option.truth && option.core) event = 'confessed'
  }
  b.suspicion = Math.max(0, Math.min(CAUGHT_AT, b.suspicion + delta))
  b.log.push({ q: q.id, event, delta })
  b.index++
  if (option?.core && option.truth) b.over = 'confessed'
  else if (b.suspicion >= CAUGHT_AT) b.over = 'caught'
  else if (b.index >= b.scenario.questions.length) b.over = b.suspicion >= (b.scenario.doubtAt ?? 55) ? 'doubted' : 'convinced'
  return { event, delta, suspicion: b.suspicion, reaction: reactionFor(q, event) }
}

function reactionFor(q, event) {
  const r = q.reactions || {}
  const d = data.reactions
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  return r[event] || pick(d[event] || d.ok)
}

/** Result for the story: outcome, cover change, and the lies to remember (lie_<fact>). */
export function bluffResult(b) {
  const remember = {}
  for (const [fact, value] of Object.entries(b.claims)) remember[`lie_${fact}`] = value
  const coverChange = { convinced: 8, doubted: -8, caught: -30, confessed: -40 }[b.over] ?? 0
  return {
    outcome: b.over,
    stats: { [b.scenario.coverStat || 'cover']: coverChange },
    remember: Object.keys(remember).length ? remember : undefined,
    flags: [`bluff_${b.id}_${b.over}`],
  }
}

/** The ledger as the bluff screen expects it, from game memory. */
export function ledgerFromMemory(memory = {}) {
  const ledger = {}
  for (const [k, v] of Object.entries(memory)) if (k.startsWith('lie_')) ledger[k.slice(4)] = v
  return ledger
}
