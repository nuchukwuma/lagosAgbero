// Repeat runs get hot. The Gauntlet under the bridge (and any activity with
// "heat": { ... } in its world JSON) gets harder each time you run it soon
// after the last time: the Task Force learns the route. Heat cools off with
// game time, and after too many runs in a row they stake the place out until
// it cools. Your notoriety makes them keener on you whatever the heat.
//
//   heatOf(game, id)          runs within the cool-off window
//   tunedActivity(game, a)    the activity with its difficulty raised (or blocked)
//   recordRun(game, id)       the game with this run counted

export const COOL_MINUTES = 6 * 60 // a run stops counting after 6 game hours
export const MAX_HOT_RUNS = 4 // after this many, the place is staked out until one cools

const now = (game) => (game.stats?.day ?? 1) * 24 * 60 + (game.time ?? 0)

export function heatOf(game, id) {
  const t = now(game)
  return (game.heat?.[id] || []).filter((at) => t - at < COOL_MINUTES).length
}

/** Minutes until the oldest counted run cools off. */
export function coolsIn(game, id) {
  const t = now(game)
  const runs = (game.heat?.[id] || []).filter((at) => t - at < COOL_MINUTES)
  return runs.length ? Math.max(0, COOL_MINUTES - (t - Math.min(...runs))) : 0
}

// free-roam activities that get harder as the story goes on (level 0..1); the
// arcade games scale themselves the same way (modes/arcade/tuning.js)
const STORY_SCALED = { fight: 1.2, runner: 1.2, chase: 1.2 }

export function tunedActivity(game, activity, level = 0) {
  if (STORY_SCALED[activity.mode] && !activity.params?.endless) {
    const base = activity.params?.difficulty ?? 1
    return { ...activity, params: { ...activity.params, difficulty: Math.min(3.5, base + level * STORY_SCALED[activity.mode]) } }
  }
  if (activity.mode === 'dance') return { ...activity, params: { ...activity.params, skill: Math.min(0.85, (activity.params?.skill ?? 0.55) + level * 0.25), level } }
  if (activity.mode !== 'runner' || !activity.params?.endless) return activity
  const heat = heatOf(game, activity.id)
  const notoriety = game.stats?.notoriety ?? 0
  if (heat >= MAX_HOT_RUNS) {
    const mins = coolsIn(game, activity.id)
    return { ...activity, blocked: `Task Force dey watch the bridge since your last runs. Come back in about ${Math.ceil(mins / 60)} hour${mins > 60 ? 's' : ''}.` }
  }
  const base = (activity.params.difficulty ?? 1) + level
  const difficulty = Math.min(4, base + heat * 0.6 + notoriety / 50)
  return { ...activity, params: { ...activity.params, difficulty, heat, notoriety } }
}

export function recordRun(game, id) {
  const t = now(game)
  const runs = (game.heat?.[id] || []).filter((at) => t - at < COOL_MINUTES)
  return { ...game, heat: { ...(game.heat || {}), [id]: [...runs, t] } }
}
