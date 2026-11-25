// Which building you're inside (null: out on the street). Going in swaps the
// 3D world for the building's own small world (data/world/interiors/*.json);
// coming out puts you back on the doorstep you went in from.
import { create } from 'zustand'
import { playerState } from '../worldState.js'
import { worldForMode } from '../../modes/modeWorlds.js'

export const useInterior = create(() => ({ id: null, from: null, owner: null }))

/** Go into a building. owner: whose place it is (Lagos Online property), if anyone's. */
export function enterInterior(id, { owner = null } = {}) {
  const p = playerState.position
  useInterior.setState((s) => ({ id, owner, from: s.from || { x: p.x, z: p.z, facing: playerState.facing + Math.PI } }))
}

/** Come back out (the world you came from loads, and you stand at the door, facing away from it). */
export function exitInterior() {
  const { id, from } = useInterior.getState()
  if (!id) return
  playerState.restore = from
  useInterior.setState({ id: null, from: null, owner: null })
}

/** The world being shown: a building you're in, a mode's own world (Back Gate), or the story's. */
const pick = (view, modeName, inside) => worldForMode(modeName, null) || inside || view?.world
export const currentWorld = (view, modeName) => pick(view, modeName, useInterior.getState().id)
export const useCurrentWorld = (view, modeName) => pick(view, modeName, useInterior((s) => s.id))
