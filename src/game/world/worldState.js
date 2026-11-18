// Live world information that changes every frame. Kept outside React state
// (mutable objects) so the 3D loop can read/write it for free. The small
// `useWorldStore` holds the few things the HUD must re-render for.

import { create } from 'zustand'
import * as THREE from 'three'

export const playerState = {
  position: new THREE.Vector3(),
  facing: 0, // radians, 0 = facing +Z
  teleport: null, // { x, z, facing } to apply on the next frame
  running: false, // set by the controller every frame
  moving: false,
  // gameplay modes can limit the player:
  canRun: true, // e.g. out of stamina in a chase
  stunUntil: 0, // performance.now() ms; the player stumbles until then
  gesture: null, // { name, speed, until } a one-shot clip (taking money, cheering); see playGesture()
  runnerView: null, // { x, z } runner position during an escape run (camera)
  viewFlipped: false, // the follow camera is filming from the north (controls flip with it)
  viewYaw: 0, // where the follow camera stands round the player (0 = south); screen-up on the stick walks away from it
  driveView: null, // { x, z, speed } the danfo you drive (drive mode camera)
  vehicleView: null, // { x, z } the conductor's danfo (camera)
  photo: null, // { pos, target, fov } a fixed camera for the menu art (tools only)
  shake: { until: 0, amp: 0 }, // camera shake (hits, crashes); see shake()
}

// Light mode (budget phones): set by GameCanvas, read by the people's animation loop
export const perf = { light: false }

/** id -> { position: Vector3 } for every NPC currently in the world */
export const npcRegistry = new Map()

export const useWorldStore = create((set) => ({
  canTalk: null, // npc id the player can talk to right now, or null
  setCanTalk: (id) => set((s) => (s.canTalk === id ? s : { canTalk: id })),
  jamUntil: 0, // performance.now() ms until which traffic crawls (go-slow event)
  setJam: (seconds) => set({ jamUntil: performance.now() + seconds * 1000 }),
  nearActivity: null, // id of a free-roam activity the player can start here
  setNearActivity: (id) => set((s) => (s.nearActivity === id ? s : { nearActivity: id })),
  nearQuest: null, // id of a side quest whose giver the player is standing next to
  setNearQuest: (id) => set((s) => (s.nearQuest === id ? s : { nearQuest: id })),
  nearVendor: null, // npc id of a seller the player is standing next to
  setNearVendor: (id) => set((s) => (s.nearVendor === id ? s : { nearVendor: id })),
}))

/** Play a short one-shot animation on the player (they stand still for it). */
export function playGesture(name, { speed = 1, seconds = 0.8 } = {}) {
  playerState.gesture = { name, speed, until: performance.now() + seconds * 1000 }
}

/** Shake the camera: amp in metres, for `seconds` (fades out). Hits, crashes, knock-outs. */
export function shake(amp = 0.25, seconds = 0.3) {
  const now = performance.now()
  const s = playerState.shake
  // a bigger shake replaces a smaller one; a small one never cuts a big one short
  if (now > s.until || amp >= s.amp) {
    s.amp = amp
    s.start = now
    s.until = now + seconds * 1000
  }
}
