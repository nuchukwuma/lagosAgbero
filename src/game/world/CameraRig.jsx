import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState, npcRegistry } from './worldState.js'

// Camera behaviour:
//   follow    behind and above the player (looks north), for walking around
//   dialogue  side-on shot of the player and whoever is talking
// Movement is smoothed so cuts never feel jumpy.

// Low enough to see the street, the buildings and the sky (not just the
// ground); it rises on its own when a building would block the view.
const FOLLOW_OFFSET = new THREE.Vector3(0, 6.2, 11.5)

// Developer: add ?cam=top to the URL for an overhead map view.
export const TOP_VIEW = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cam') === 'top'
const tmpPos = new THREE.Vector3()
const tmpLook = new THREE.Vector3()
const lookAt = new THREE.Vector3()

// `ceiling` (optional): { x, width, deckY, fromZ, toZ } — the flyover. Under it
// the camera drops below the deck instead of filming concrete.
function blockedHeight(p, cam, obstacles, samples = [0.45, 0.7, 1]) {
  let need = 0
  for (const t of samples) {
    const x = p.x + (cam.x - p.x) * t
    const z = p.z + (cam.z - p.z) * t
    for (const o of obstacles) {
      if (o.h < 2.6) continue
      const dx = x - o.x
      const dz = z - o.z
      const c = Math.cos(o.angle)
      const s = Math.sin(o.angle)
      const lx = dx * c - dz * s
      const lz = dx * s + dz * c
      if (Math.abs(lx) < o.hw + 1 && Math.abs(lz) < o.hd + 1) need = Math.max(need, o.h + 2.5 + (1 - t) * 4)
    }
  }
  return need
}

// `obstacles` (optional): [{ x, z, hw, hd, angle, h }] building footprints.
export default function CameraRig({ mode = 'follow', speaker = null, ceiling = null, obstacles = null }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const follow = useRef({ kind: 'south', clearSince: 0 })

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
    if (mode === 'drive' && playerState.driveView) {
      // chase cam behind the bus; pulls back as the speed rises
      const v = playerState.driveView
      const back = (portrait ? 13 : 10.5) + (v.speed || 0) * 0.18
      tmpLook.set(v.x * 0.85, 1.6, v.z - (portrait ? 16 : 14))
      tmpPos.set(v.x * 0.8 + 0.6, portrait ? 6.4 : 5.0, v.z + back)
      const t2 = 1 - Math.exp(-delta * 6)
      camera.position.lerp(tmpPos, t2)
      lookAt.lerp(tmpLook, t2)
      camera.lookAt(lookAt)
      return
    }
    if (mode === 'vehicle' && playerState.vehicleView) {
      const v = playerState.vehicleView
      tmpLook.set(v.x + 1, 1.3, v.z)
      tmpPos.set(v.x - 3, portrait ? 6 : 4.5, v.z + (portrait ? 12 : 9.5))
    } else if (mode === 'fight' && playerState.fightView) {
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
      // Film from the street side. On the south side of the road the houses
      // are behind the camera, so film from the north instead.
      const fromNorth = (p.z + n.z) / 2 > 4
      if (fromNorth ? pz > 0 : pz < 0) {
        px = -px
        pz = -pz
      }
      // blend the side direction with the street side and normalise
      let ox = px * 0.7
      let oz = pz * 0.7 + (fromNorth ? -0.7 : 0.7)
      const ol = Math.hypot(ox, oz) || 1
      ox /= ol
      oz /= ol
      const dist = (portrait ? 7.5 : 5.8) + d * 0.5
      tmpPos.set(mid.x + ox * dist, portrait ? 4.6 : 3.8, mid.z + oz * dist)
    } else if (mode === 'dialogue') {
      // nobody to frame (narrator / phone call): closer shot of the player
      tmpLook.set(p.x, 1.2, p.z)
      const side = p.z > 4 ? -1 : 1
      tmpPos.set(p.x + 2, portrait ? 4.8 : 4, p.z + side * (portrait ? 7.5 : 6.5))
    } else {
      // Ways to film the player, tried in order:
      //   south  the normal view: camera south of the player, looking north
      //   high   the same, raised just enough to clear the roofs in the way
      //   north  when houses block the south side badly
      //   over   looking almost straight down (last resort)
      const k = portrait ? 1.3 : 1
      const back = FOLLOW_OFFSET.z * (portrait ? 1.1 : 1)
      const now = performance.now()
      const view = follow.current
      const southNeed = obstacles ? blockedHeight(p, tmpPos.set(p.x, FOLLOW_OFFSET.y * k, p.z + back), obstacles) : 0
      // is the blockage right next to the player (raising won't help) or only where the camera stands?
      const southNear = obstacles && southNeed ? blockedHeight(p, tmpPos.set(p.x, FOLLOW_OFFSET.y * k, p.z + back), obstacles, [0.3, 0.55]) : 0
      const northNeed = obstacles ? blockedHeight(p, tmpPos.set(p.x, FOLLOW_OFFSET.y * k, p.z - back), obstacles) : 0
      let want = southNeed === 0 ? 'south' : southNear === 0 && southNeed < 13 ? 'high' : northNeed === 0 && p.z > 2 ? 'north' : 'over'
      // don't flip back and forth: switch sides only when the current view is
      // blocked, or once the normal view has been clear for a moment
      const sideOf = (kind) => (kind === 'north' ? 'north' : kind === 'over' ? 'over' : 'south')
      if (sideOf(want) !== sideOf(view.kind) && view.kind !== 'over') {
        // leave the current side only if it is blocked; come back to the
        // normal (south) side once it has been clear for a moment
        const currentBlocked = view.kind === 'north' ? northNeed > 0 : southNear > 0 || southNeed >= 13
        const settled = sideOf(want) === 'south' && now - view.clearSince > 700
        if (!currentBlocked && !settled) want = view.kind
      }
      if (southNear > 0 || southNeed >= 13) view.clearSince = now
      view.kind = want
      playerState.viewFlipped = want === 'north'
      if (want === 'north') {
        tmpLook.set(p.x, 1.5, p.z + 3)
        tmpPos.set(p.x, FOLLOW_OFFSET.y * k, p.z - back)
      } else if (want === 'over') {
        // from above, leaning out over the open street (not over the roofs)
        const side = p.z > 2 ? -1 : 1
        tmpLook.set(p.x, 1.0, p.z + side * 0.5)
        tmpPos.set(p.x, 13 * k, p.z + side * 5)
      } else if (want === 'high') {
        tmpLook.set(p.x, 1.2, p.z - 2)
        tmpPos.set(p.x + FOLLOW_OFFSET.x, Math.max(FOLLOW_OFFSET.y * k, southNeed), p.z + back * 0.8)
      } else {
        tmpLook.set(p.x, 1.5, p.z - 3)
        tmpPos.set(p.x + FOLLOW_OFFSET.x, FOLLOW_OFFSET.y * k, p.z + back)
      }
    }
    if (mode !== 'follow') playerState.viewFlipped = false

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
