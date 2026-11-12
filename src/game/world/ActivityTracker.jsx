import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { playerState, useWorldStore } from './worldState.js'
import { checkCondition } from '../narrative/conditions.js'

// During free roam: is the player standing somewhere they can start an
// activity (world JSON "activities", e.g. FEE RUN at the Back Side)?
export default function ActivityTracker({ layout, game }) {
  const setNearActivity = useWorldStore((s) => s.setNearActivity)
  useEffect(() => () => setNearActivity(null), [setNearActivity])
  useFrame(() => {
    const p = playerState.position
    let found = null
    for (const a of layout.raw.activities || []) {
      const spot = layout.spots[a.spot]
      if (!spot || !checkCondition(a.if, game)) continue
      if (Math.hypot(p.x - spot.pos[0], p.z - spot.pos[1]) < (spot.radius || 3)) {
        found = a.id
        break
      }
    }
    setNearActivity(found)
  })
  return null
}
