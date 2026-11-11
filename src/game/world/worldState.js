// Live world information that changes every frame. Kept outside React state
// (mutable objects) so the 3D loop can read/write it for free. The small
// `useWorldStore` holds the few things the HUD must re-render for.

import { create } from 'zustand'
import * as THREE from 'three'

export const playerState = {
  position: new THREE.Vector3(),
  facing: 0, // radians, 0 = facing +Z
  teleport: null, // { x, z, facing } to apply on the next frame
}

/** id -> { position: Vector3 } for every NPC currently in the world */
export const npcRegistry = new Map()

export const useWorldStore = create((set) => ({
  canTalk: null, // npc id the player can talk to right now, or null
  setCanTalk: (id) => set((s) => (s.canTalk === id ? s : { canTalk: id })),
}))
