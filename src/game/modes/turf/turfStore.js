// Turf Flag Brawl: what the overlay shows. The match itself (turfLogic) lives
// in `turf.current`, stepped by TurfScene inside the 3D canvas.
import { create } from 'zustand'

export const turf = { current: null }
// keys held (up/down/left/right), the stick (x right, y up), a shove waiting to happen
export const turfInput = { keys: new Set(), stick: { x: 0, y: 0 }, shove: false }

/** The way to go in the world: the camera looks north (-z), so up on the stick is -z. */
export function readTurfInput() {
  const k = turfInput.keys
  let mx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + turfInput.stick.x
  let mz = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0) - turfInput.stick.y
  const len = Math.hypot(mx, mz)
  if (len > 1) {
    mx /= len
    mz /= len
  }
  const shove = turfInput.shove
  turfInput.shove = false
  return { mx, mz, shove }
}

export const useTurf = create((set) => ({
  active: false,
  started: false,
  params: {},
  attempt: 0,
  hud: null, // { time, score: { you, them }, flags: [{ id, label, owner, p, contested }], cd, out }
  ended: false,
  start: (params) => set((s) => ({ active: true, started: false, params, ended: false, hud: null, attempt: s.attempt + 1 })),
  begin: () => set({ started: true }),
  retry: () => set((s) => ({ started: true, ended: false, hud: null, attempt: s.attempt + 1 })),
  reset: () => {
    turf.current = null
    turfInput.keys.clear()
    turfInput.stick = { x: 0, y: 0 }
    turfInput.shove = false
    set({ active: false, started: false, ended: false })
  },
}))
