import { useEffect } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { playerState } from '../../game/world/worldState.js'

// Drains energy (and lands drink crashes) while the player is out on the
// street. Paused during dialogue, menus and the shop.
const STEP = 0.5 // seconds

export default function EnergyTicker({ active }) {
  const tick = useGameStore((s) => s.tick)
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => {
      if (document.hidden) return
      tick(STEP, { running: playerState.running })
    }, STEP * 1000)
    return () => clearInterval(id)
  }, [active, tick])
  return null
}
