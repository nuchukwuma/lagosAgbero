import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { npcRegistry, playerState, useWorldStore } from './worldState.js'
import { VENDORS } from '../systems/energy.js'

// While walking around, notices when the player stands next to someone who
// sells things (Baba Paraga, Mama Put, Ada, Mallam Garba, Comedian Ẹ̀wọ̀).
const REACH = 2.6

export default function VendorTracker() {
  const setNearVendor = useWorldStore((s) => s.setNearVendor)
  useEffect(() => () => setNearVendor(null), [setNearVendor])
  useFrame(() => {
    const p = playerState.position
    let best = null
    let bestD = REACH
    for (const id of Object.keys(VENDORS)) {
      const n = npcRegistry.get(id)
      if (!n) continue
      const d = Math.hypot(n.position.x - p.x, n.position.z - p.z)
      if (d < bestD) {
        best = id
        bestD = d
      }
    }
    setNearVendor(best)
  })
  return null
}
