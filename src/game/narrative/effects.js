// Effects change the game state. They appear on choice options, on mode
// results, and in setFlag / changeStat beats:
//
//   "effects": {
//     "setFlag": "letDriverGo"            (or an array)
//     "clearFlag": "hiding"               (or an array)
//     "changeStat": { "chairmanTrust": -5, "money": 200 },
//     "remember": { "biodun_ch1": "let_go" },   // for callbacks later
//     "toast": "Biodun owes you one.",
//     "noticedBy": ["Professor"],         // shows "Professor will remember that."
//     "goto": "sceneId"  or  "chapterId:sceneId",
//     "startMode": "chase", "params": { ... }, "results": { "won": {...}, "lost": {...} },
//     "ending": "rock_bottom"
//   }
//
// applyEffects only changes numbers, flags and memory. Flow keys (goto,
// startMode, ending) are handled by the story engine.

import { clampStat, STAT_DEFS } from './stats.js'

const asList = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/** Returns { state, notices } — notices are short toasts for the player. */
export function applyEffects(state, effects) {
  if (!effects) return { state, notices: [] }
  const notices = []
  let flags = state.flags
  let stats = state.stats
  let memory = state.memory

  if (effects.setFlag || effects.clearFlag) {
    flags = { ...flags }
    for (const f of asList(effects.setFlag)) flags[f] = true
    for (const f of asList(effects.clearFlag)) delete flags[f]
  }

  if (effects.changeStat) {
    stats = { ...stats }
    const who = new Set()
    for (const [key, delta] of Object.entries(effects.changeStat)) {
      stats[key] = clampStat(key, (stats[key] ?? 0) + delta)
      if (STAT_DEFS[key]?.who && delta !== 0) who.add(STAT_DEFS[key].who)
    }
    // Feelable consequences without spelling out the numbers.
    if (!effects.noticedBy) for (const w of who) notices.push(`${w} will remember that.`)
  }

  if (effects.remember) memory = { ...memory, ...effects.remember }
  for (const w of asList(effects.noticedBy)) notices.push(`${w} will remember that.`)
  if (effects.toast) notices.push(effects.toast)

  return { state: { ...state, flags, stats, memory }, notices }
}

/** Turns a mode result object into effects, e.g.
 *  { outcome: "won", moneyChange: 500, flags: ["caughtDefaulter"], stats: {...} } */
export function resultToEffects(result) {
  const changeStat = { ...(result.stats || {}) }
  if (result.moneyChange) changeStat.money = (changeStat.money || 0) + result.moneyChange
  return {
    setFlag: result.flags,
    clearFlag: result.clearFlags,
    changeStat: Object.keys(changeStat).length ? changeStat : undefined,
    remember: result.remember,
  }
}
