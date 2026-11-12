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
  fightView: null, // { x, z } centre of a fight in progress (camera)
  runnerView: null, // { x, z } runner position during an escape run (camera)
  vehicleView: null, // { x, z } the conductor's danfo (camera)
}

/** id -> { position: Vector3 } for every NPC currently in the world */
export const npcRegistry = new Map()

export const useWorldStore = create((set) => ({
  canTalk: null, // npc id the player can talk to right now, or null
  setCanTalk: (id) => set((s) => (s.canTalk === id ? s : { canTalk: id })),
  jamUntil: 0, // performance.now() ms until which traffic crawls (go-slow event)
  setJam: (seconds) => set({ jamUntil: performance.now() + seconds * 1000 }),
  nearActivity: null, // id of a free-roam activity the player can start here
  setNearActivity: (id) => set((s) => (s.nearActivity === id ? s : { nearActivity: id })),
  nearVendor: null, // npc id of a seller the player is standing next to
  setNearVendor: (id) => set((s) => (s.nearVendor === id ? s : { nearVendor: id })),
}))
