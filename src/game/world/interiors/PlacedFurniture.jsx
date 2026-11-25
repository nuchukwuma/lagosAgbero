import { useEffect, useMemo } from 'react'
import { Model } from '../Model.jsx'
import { getAsset } from '../../../assets/assetManifest.js'
import { GROUND_Y } from '../layout.js'
import { playerState } from '../worldState.js'

// Furniture someone has put in a place they own (Lagos Online property), on
// top of what the building already has. Each piece also blocks like a wall.
const DEG = Math.PI / 180

export default function PlacedFurniture({ items }) {
  const colliders = useMemo(
    () =>
      (items || []).map((f) => {
        const s = getAsset(f.model).size
        return { x: f.x, z: f.z, hw: (s[0] / 2) * 0.9, hd: (s[2] / 2) * 0.9, angle: (f.rot || 0) * DEG }
      }),
    [items],
  )
  useEffect(() => {
    playerState.extraColliders = colliders.length ? colliders : null
    return () => {
      playerState.extraColliders = null
    }
  }, [colliders])
  return (items || []).map((f, i) => <Model key={`${i}-${f.model}`} name={f.model} position={[f.x, GROUND_Y, f.z]} rotation-y={(f.rot || 0) * DEG} />)
}
