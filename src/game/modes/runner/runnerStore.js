// One escape run. Story params (startMode "runner"):
//   goal        metres to escape (default 320)
//   difficulty  1..3
//   chaser      "taskForce" (default) | "hyenas" | "mob" — who is behind you
//   seed        course layout

import { create } from 'zustand'

export const runnerInput = { left: false, right: false, jump: false, slide: false }

export const useRunner = create((set, get) => ({
  active: false,
  started: false,
  params: {},
  hud: { distance: 0, goal: 320, hits: 0, maxHits: 3, notes: 0, pursuer: 18 },
  ended: null,

  start: (params) => set({ active: true, started: false, params, ended: null, hud: { distance: 0, goal: params.goal ?? 320, hits: 0, maxHits: 3, notes: 0, pursuer: 18 } }),
  begin: () => set({ started: true }),
  reset: () => {
    Object.assign(runnerInput, { left: false, right: false, jump: false, slide: false })
    set({ active: false, started: false, ended: null })
  },
  end: (outcome) => !get().ended && set({ ended: outcome }),

  result() {
    const { ended, hud } = get()
    return ended === 'escaped'
      ? { outcome: 'escaped', moneyChange: hud.notes * 100, stats: { energy: -10, notoriety: 1 }, flags: ['escapedRun'] }
      : { outcome: 'caught', stats: { energy: -15 }, flags: ['caughtRun'] }
  },
}))
