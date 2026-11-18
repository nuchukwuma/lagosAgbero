import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState, npcRegistry } from './worldState.js'
import { cam, cycleView, dragView, zoomView, turnView } from './camView.js'
import { vehicleColliders } from '../systems/traffic.js'
import { blockedHeight, fightSideBlock } from './cameraMath.js'

// Camera behaviour:
//   follow    behind and above the player (looks north), for walking around;
//             or wherever the player puts it (camView.js: the camera button,
//             V, dragging the screen, Q / R, the wheel or a pinch)
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
// `obstacles` (optional): [{ x, z, hw, hd, angle, h }] building footprints.
export default function CameraRig({ mode = 'follow', speaker = null, ceiling = null, obstacles = null }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const follow = useRef({ kind: 'south', clearSince: 0 })
  const fightCam = useRef({ key: '', lift: 0 })
  const gl = useThree((s) => s.gl)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Changing the view while walking around: drag the screen (one finger or the
  // mouse) to swing the camera round, pinch or wheel to zoom, the camera
  // button / V to step through the set views, Q / R to turn.
  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map()
    let pinch = 0
    let moved = false
    const free = () => modeRef.current === 'follow'
    const down = (e) => {
      if (!free()) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = false
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last || !free()) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && d > 0) zoomView(pinch / d)
        pinch = d
        return
      }
      if (!moved && Math.hypot(dx, dy) < 3) return
      moved = true
      dragView(dx, dy)
    }
    const up = (e) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    const wheel = (e) => {
      if (!free()) return
      e.preventDefault()
      zoomView(e.deltaY > 0 ? 1.1 : 1 / 1.1)
    }
    const key = (e) => {
      if (!free() || e.target.closest?.('input, textarea, select')) return
      if (e.code === 'KeyV') cycleView()
      else if (e.code === 'KeyQ') turnView(-1)
      else if (e.code === 'KeyR') turnView(1)
    }
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', key)
    }
  }, [gl])

  useFrame((_, delta) => {
    const p = playerState.position
    const portrait = size.height > size.width
    const npc = speaker ? npcRegistry.get(speaker) : null

    // photo mode (dev / ?bench tools only): a fixed camera for the menu art
    if (playerState.photo) {
      const ph = playerState.photo
      camera.position.set(...ph.pos)
      camera.lookAt(...ph.target)
      if (ph.fov && camera.fov !== ph.fov) {
        camera.fov = ph.fov
        camera.updateProjectionMatrix()
      }
      return
    }
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
      // side-on, fighting-game style. Always from the south, so screen left and
      // right match the move buttons; if something tall stands in between (a
      // parked danfo), the camera rises to film over it.
      const c = playerState.fightView
      const dist = portrait ? 9 : 6.5
      const f = fightCam.current
      const key = `${c.x.toFixed(1)},${c.z.toFixed(1)},${dist}`
      if (f.key !== key || f.fight !== c) {
        f.key = key
        f.fight = c // a new fight on the same spot decides afresh
        // Film from the south if a sensible height sees over what's in between;
        // if not (a danfo right next to the fight), from the north, and the
        // fight is mirrored (FightDirector) so you stay on the left of the screen.
        const solid = (obstacles || []).concat(vehicleColliders().map((v) => ({ ...v, h: 2.3 })))
        const south = fightSideBlock(c, 1, dist, solid)
        const north = south > 5 ? fightSideBlock(c, -1, dist, solid) : Infinity
        c.side = north < south ? -1 : 1
        f.lift = Math.min(9, c.side > 0 ? south : north)
      }
      // On a landscape phone the health bars sit across the top third, so the
      // fighters are framed a little low (the camera looks above their heads).
      const low = !portrait && size.height < 560 ? 0.55 : 0
      tmpLook.set(c.x, 1.05 + low + (f.lift > 4 ? -0.3 : 0), c.z)
      tmpPos.set(c.x, Math.max(portrait ? 3.2 : 2.4, f.lift), c.z + (c.side || 1) * dist)
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
    } else if (cam.mode !== 'auto') {
      // the player's own view: wherever they put the camera. If something is
      // in the way, the camera moves in closer, and up as a last resort.
      const dist = 13 * cam.zoom * (portrait ? 1.15 : 1)
      const sx = Math.sin(cam.yaw)
      const sz = Math.cos(cam.yaw)
      const ce = Math.cos(cam.elev)
      const se = Math.sin(cam.elev)
      const ahead = 3 * Math.max(0, 1 - (cam.elev - 0.3)) // look a little ahead, less when looking down
      tmpLook.set(p.x - sx * ahead, 1.3, p.z - sz * ahead)
      let need = 0
      for (const f of [1, 0.8, 0.62, 0.48, 0.36]) {
        tmpPos.set(p.x + sx * dist * ce * f, Math.max(2.2, 1.3 + dist * se * f), p.z + sz * dist * ce * f)
        need = obstacles ? blockedHeight(p, tmpPos, obstacles) : 0
        if (!need || tmpPos.y >= need) {
          need = 0
          break
        }
      }
      if (need) tmpPos.y = Math.min(20, need)
      playerState.viewYaw = cam.yaw
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
      // which way the game is filming from (the controls follow it; dragging starts from here)
      cam.autoYaw = want === 'north' || (want === 'over' && p.z > 2) ? Math.PI : 0
      playerState.viewYaw = cam.autoYaw
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
    if (mode !== 'follow') {
      playerState.viewFlipped = false
      playerState.viewYaw = 0
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
    // shake (hits, crashes): a small random offset that fades out. Applied
    // after the smooth follow, and undone next frame by the follow itself.
    const sh = playerState.shake
    const now = performance.now()
    if (sh.until > now) {
      const k = sh.amp * ((sh.until - now) / (sh.until - sh.start))
      camera.position.x += (Math.random() - 0.5) * 2 * k
      camera.position.y += (Math.random() - 0.5) * 2 * k
    }
  })
  return null
}
