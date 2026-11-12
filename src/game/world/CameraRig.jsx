import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState, npcRegistry } from './worldState.js'

// Camera behaviour:
//   follow    behind and above the player (looks north), for walking around
//   dialogue  side-on shot of the player and whoever is talking
// Movement is smoothed so cuts never feel jumpy.

const FOLLOW_OFFSET = new THREE.Vector3(0, 9, 12.5)

// Developer: add ?cam=top to the URL for an overhead map view.
export const TOP_VIEW = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cam') === 'top'
const tmpPos = new THREE.Vector3()
const tmpLook = new THREE.Vector3()
const lookAt = new THREE.Vector3()

// `ceiling` (optional): { x, width, deckY, fromZ, toZ } — the flyover. Under it
// the camera drops below the deck instead of filming concrete.
export default function CameraRig({ mode = 'follow', speaker = null, ceiling = null }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useFrame((_, delta) => {
    const p = playerState.position
    const portrait = size.height > size.width
    const npc = speaker ? npcRegistry.get(speaker) : null

    if (TOP_VIEW) {
      camera.position.set(0, 135, 1)
      camera.lookAt(0, 0, 0)
      return
    }
    if (mode === 'runner' && playerState.runnerView) {
      const r = playerState.runnerView
      tmpLook.set(r.x * 0.7, 1.1, r.z - 7)
      tmpPos.set(r.x * 0.6, portrait ? 4.4 : 3.6, r.z + (portrait ? 7.5 : 6.5))
      camera.position.copy(tmpPos) // follow tightly: the run is fast
      lookAt.copy(tmpLook)
      camera.lookAt(lookAt)
      return
    }
    if (mode === 'fight' && playerState.fightView) {
      // side-on, fighting-game style
      const c = playerState.fightView
      tmpLook.set(c.x, 1.05, c.z)
      tmpPos.set(c.x, portrait ? 3.2 : 2.4, c.z + (portrait ? 9 : 6.5))
    } else if (mode === 'dialogue' && npc) {
      // Raised three-quarter shot from the street side (south), so poles and
      // parked danfos rarely block the faces.
      const n = npc.position
      const mid = tmpLook.set((p.x + n.x) / 2, 1.25, (p.z + n.z) / 2)
      const dx = n.x - p.x
      const dz = n.z - p.z
      const d = Math.hypot(dx, dz) || 1
      let px = dz / d
      let pz = -dx / d
      if (pz < 0) {
        px = -px
        pz = -pz
      }
      // blend the side direction with "south" and normalise
      let ox = px * 0.7
      let oz = pz * 0.7 + 0.7
      const ol = Math.hypot(ox, oz) || 1
      ox /= ol
      oz /= ol
      const dist = (portrait ? 7.5 : 5.8) + d * 0.5
      tmpPos.set(mid.x + ox * dist, portrait ? 4.6 : 3.8, mid.z + oz * dist)
    } else if (mode === 'dialogue') {
      // nobody to frame (narrator / phone call): closer shot of the player
      tmpLook.set(p.x, 1.2, p.z)
      tmpPos.set(p.x + 2, portrait ? 4.8 : 4, p.z + (portrait ? 7.5 : 6.5))
    } else {
      const k = portrait ? 1.25 : 1
      tmpLook.set(p.x, 1.1, p.z - 2)
      tmpPos.set(p.x + FOLLOW_OFFSET.x, FOLLOW_OFFSET.y * k, p.z + FOLLOW_OFFSET.z * k)
    }

    if (ceiling && Math.abs(tmpPos.x - ceiling.x) < ceiling.width / 2 + 2 && tmpPos.z > ceiling.fromZ && tmpPos.z < ceiling.toZ) {
      const maxY = ceiling.deckY - 1.4
      if (tmpPos.y > maxY) {
        // pull in closer and lower so the player stays in view under the bridge
        tmpPos.x = p.x + (tmpPos.x - p.x) * 0.6
        tmpPos.z = p.z + (tmpPos.z - p.z) * 0.6
        tmpPos.y = maxY
      }
    }
    const t = 1 - Math.exp(-delta * (mode === 'dialogue' ? 3 : 5))
    camera.position.lerp(tmpPos, t)
    lookAt.lerp(tmpLook, t)
    camera.lookAt(lookAt)
  })
  return null
}
