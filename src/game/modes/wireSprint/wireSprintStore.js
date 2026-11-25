// Wire Sprint: what the overlay shows. The race itself (wireSprintLogic) lives
// in `race.current`, stepped by WireSprintScene inside the 3D canvas.
import { create } from 'zustand'

export const race = { current: null }
export const sprintInput = { keys: new Set(), touch: { left: false, right: false, gas: false, brake: false } }

export function readSprintInput() {
  const k = sprintInput.keys
  const t = sprintInput.touch
  return {
    steer: (k.has('right') || t.right ? 1 : 0) - (k.has('left') || t.left ? 1 : 0),
    gas: k.has('gas') || t.gas ? 1 : 0,
    brake: k.has('brake') || t.brake ? 1 : 0,
  }
}

export const useSprint = create((set) => ({
  active: false,
  started: false,
  params: {},
  attempt: 0,
  hud: null, // { time, speed, boost, drops: [{ name, hit, dist, dir }], rivals: [{ name, hits }] }
  ended: false,
  start: (params) => set((s) => ({ active: true, started: false, params, ended: false, hud: null, attempt: s.attempt + 1 })),
  begin: () => set({ started: true }),
  retry: () => set((s) => ({ started: true, ended: false, hud: null, attempt: s.attempt + 1 })),
  reset: () => {
    race.current = null
    sprintInput.keys.clear()
    Object.assign(sprintInput.touch, { left: false, right: false, gas: false, brake: false })
    set({ active: false, started: false, ended: false })
  },
}))
