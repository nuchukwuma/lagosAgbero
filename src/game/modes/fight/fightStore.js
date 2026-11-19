// One fight: shared by the 3D director (runs the rules each frame and moves
// the fighters) and the overlay (health bars, buttons).
//
// Story params (startMode "fight"):
//   opponent    id from fighters.json ("kpakpa", "conductor", "scatter", "taskForce"...)
//   difficulty  1..3

import { create } from 'zustand'
import fighters from '../../data/fighters.json'
import { COIN } from './fightLogic.js'

// Buttons/keys write here; the director reads and clears the "pressed" ones.
export const fightInput = { move: 0, block: false, punch: false, kick: false, special: false, dodge: false, jump: false, crouch: false }

export function opponentProfile(id) {
  return fighters[id] || fighters.thug
}

export const useFight = create((set, get) => ({
  active: false,
  started: false,
  params: {},
  hud: { php: 100, pmax: 100, ohp: 100, omax: 100, special: 0, name: '' },
  ended: null,
  stats: { dealt: 0, taken: 0 },
  coins: 0, // thrown by the crowd; the winner keeps them
  attempt: 0, // goes up on "Try again": a fresh fight from the start
  revives: 0, // "Get back up" (an ad each, more each time) used this fight
  reviveReq: false, // the 2D fight picks this up and stands you back up
  bestCombo: 0,

  start(params) {
    set({ active: true, started: false, params, ended: null, coins: 0, revives: 0, reviveReq: false, bestCombo: 0, stats: { dealt: 0, taken: 0 }, hud: { php: 100, pmax: 100, ohp: 100, omax: 100, special: 0, name: opponentProfile(params.opponent).name } })
  },
  begin: () => set({ started: true }),
  /** Fight again from the start, straight in (no intro). */
  retry: () => {
    const { params, attempt } = get()
    get().start(params)
    set({ attempt: attempt + 1, started: true })
  },
  /** Back on your feet with some health, the same fight going on. */
  revive: () => set((s) => ({ ended: null, reviveReq: true, revives: s.revives + 1 })),
  reset: () => {
    Object.assign(fightInput, { move: 0, block: false, punch: false, kick: false, special: false, dodge: false, jump: false, crouch: false })
    set({ active: false, started: false, ended: null })
  },
  end: (outcome) => !get().ended && set({ ended: outcome }),

  result() {
    const s = get()
    const energy = -Math.round(5 + s.stats.taken * 0.15)
    return s.ended === 'won'
      ? { outcome: 'won', moneyChange: s.coins * COIN, stats: { energy, notoriety: 2 }, flags: ['wonFight'] }
      : { outcome: 'lost', stats: { energy: energy - 5 }, flags: ['lostFight'] }
  },
}))
