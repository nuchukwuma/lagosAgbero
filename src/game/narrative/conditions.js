// Conditions decide whether a beat plays, a text variant shows, or a choice is
// available. Written in story JSON as:
//
//   "if": "metAda"                       flag is set
//   "if": "!letDriverGo"                 flag is NOT set
//   "if": { "flags": ["a","b"], "notFlags": ["c"],
//           "stats": { "friendBond": ">= 20", "money": ">= 500" },
//           "memory": { "biodun_ch1": "chased" },
//           "anyOf": [ <condition>, <condition> ] }
//
// All parts must be true (AND). Use anyOf for OR.

const OPS = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

/** Parses ">= 20" into { op: '>=', value: 20 }. A bare number means ">=". */
export function parseComparison(expr) {
  if (typeof expr === 'number') return { op: '>=', value: expr }
  const m = String(expr).trim().match(/^(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) throw new Error(`Bad comparison "${expr}". Use e.g. ">= 20"`)
  return { op: m[1], value: Number(m[2]) }
}

export function compare(actual, expr) {
  const { op, value } = parseComparison(expr)
  return OPS[op](actual ?? 0, value)
}

export function checkCondition(cond, state) {
  if (cond === undefined || cond === null) return true
  if (typeof cond === 'string') {
    return cond.startsWith('!') ? !state.flags[cond.slice(1)] : Boolean(state.flags[cond])
  }
  if (Array.isArray(cond)) return cond.every((c) => checkCondition(c, state))

  if (cond.flags && !cond.flags.every((f) => state.flags[f])) return false
  if (cond.notFlags && cond.notFlags.some((f) => state.flags[f])) return false
  if (cond.stats) {
    for (const [key, expr] of Object.entries(cond.stats)) {
      if (!compare(state.stats[key], expr)) return false
    }
  }
  if (cond.memory) {
    for (const [key, value] of Object.entries(cond.memory)) {
      const allowed = Array.isArray(value) ? value : [value]
      if (!allowed.includes(state.memory[key])) return false
    }
  }
  if (cond.anyOf && !cond.anyOf.some((c) => checkCondition(c, state))) return false
  return true
}

/** A short human reason why a condition fails (for locked choices). */
export function describeCondition(cond) {
  if (!cond) return ''
  if (typeof cond === 'string') return cond.startsWith('!') ? `not ${cond.slice(1)}` : cond
  const parts = []
  if (cond.stats) for (const [k, v] of Object.entries(cond.stats)) parts.push(`${k} ${typeof v === 'number' ? `>= ${v}` : v}`)
  if (cond.flags) parts.push(...cond.flags)
  if (cond.memory) parts.push(...Object.keys(cond.memory))
  return parts.join(', ')
}
