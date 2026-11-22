// Back Gate (3D): what the screen shows about the mission. The mission itself
// (guards, grid) lives in `mission.current`, stepped by StealthDirector inside
// the 3D canvas; this store holds the few numbers the overlay needs.
import { create } from 'zustand'

export const mission = { current: null } // the stealthLogic mission object

export const useStealth = create((set) => ({
  active: false,
  started: false,
  params: {},
  attempt: 0,
  hud: { time: 0, left: 0, total: 0, tries: 3, cash: 0, open: false, canTakedown: null, caught: false },
  ended: null, // the mission result once it's over
  start: (params) => set((s) => ({ active: true, started: false, params, ended: null, attempt: s.attempt + 1 })),
  begin: () => set({ started: true }),
  retry: () => set((s) => ({ started: true, ended: null, attempt: s.attempt + 1 })),
  reset: () => {
    mission.current = null
    set({ active: false, started: false, ended: null })
  },
}))
