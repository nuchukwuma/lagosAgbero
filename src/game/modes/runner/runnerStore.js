// One escape run. Story params (startMode "runner"):
//   goal        metres to escape (default 320)
//   difficulty  1..3
//   chaser      "taskForce" (default) | "hyenas" | "mob" — who is behind you
//   seed        course layout
//   endless     true: the Gauntlet, no finish line; the score is the distance
//               (best kept on this device)

import { create } from 'zustand'

const BEST_KEY = 'areaBoy.gauntletBest' // (old prefix kept, like the other saved keys)
export function bestDistance() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
function recordBest(metres) {
  const best = Math.max(bestDistance(), metres)
  try {
    window.localStorage.setItem(BEST_KEY, String(best))
  } catch {
    // storage blocked: the best lasts for this run only
  }
  return best
}

export const runnerInput = { left: false, right: false, jump: false, slide: false, throw: false }

export const useRunner = create((set, get) => ({
  active: false,
  started: false,
  params: {},
  hud: { distance: 0, goal: 320, hits: 0, maxHits: 3, notes: 0, pursuer: 18 },
  ended: null,
  revives: 0, // "Keep running" (an ad each, one more each time) used this run
  reviveReq: false,

  revive: () => set((s) => ({ ended: null, reviveReq: true, revives: s.revives + 1 })),
  start: (params) => set({ active: true, started: false, params, ended: null, revives: 0, reviveReq: false, hud: { distance: 0, goal: params.goal ?? 320, hits: 0, maxHits: 3, notes: 0, pursuer: 18 } }),
  begin: () => set({ started: true }),
  reset: () => {
    Object.assign(runnerInput, { left: false, right: false, jump: false, slide: false, throw: false })
    set({ active: false, started: false, ended: null })
  },
  end: (outcome) => !get().ended && set({ ended: outcome }),

  result() {
    const { ended, hud, params } = get()
    if (params.endless) {
      const metres = Math.round(hud.distance)
      const best = recordBest(metres)
      // pay by distance: ₦10 a metre past the first 100, plus the notes
      return { outcome: 'done', moneyChange: hud.notes * 100 + Math.max(0, metres - 100) * 10, stats: { energy: -12, notoriety: metres > 600 ? 2 : 1 }, metres, best, newBest: metres >= best && metres > 0 }
    }
    return ended === 'escaped'
      ? { outcome: 'escaped', moneyChange: hud.notes * 100, stats: { energy: -10, notoriety: 1 }, flags: ['escapedRun'] }
      : { outcome: 'caught', stats: { energy: -15 }, flags: ['caughtRun'] }
  },
}))
