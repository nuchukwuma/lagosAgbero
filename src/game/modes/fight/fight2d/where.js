import { playerState } from '../../../world/worldState.js'
import { getLayout } from '../../../world/worlds.js'

/** Which place a 2D scene (a fight, a dance battle) is in: the activity's own spot, or the spot nearest the player. */
export function placeHere(world, activitySpot) {
  if (activitySpot) return activitySpot
  const spots = getLayout(world)?.spots || {}
  let best = null
  let bestD = Infinity
  for (const [id, sp] of Object.entries(spots)) {
    const d = Math.hypot(sp.pos[0] - playerState.position.x, sp.pos[1] - playerState.position.z)
    if (d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}
