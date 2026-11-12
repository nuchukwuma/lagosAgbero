// One fight: shared by the 3D director (runs the rules each frame and moves
// the fighters) and the overlay (health bars, buttons).
//
// Story params (startMode "fight"):
//   opponent    id from fighters.json ("kpakpa", "conductor", "scatter", "taskForce"...)
//   difficulty  1..3

import { create } from 'zustand'
import fighters from '../../data/fighters.json'

// Buttons/keys write here; the director reads and clears the "pressed" ones.
export const fightInput = { move: 0, block: false, punch: false, kick: false, special: false, dodge: false }

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

  start(params) {
    set({ active: true, started: false, params, ended: null, stats: { dealt: 0, taken: 0 }, hud: { php: 100, pmax: 100, ohp: 100, omax: 100, special: 0, name: opponentProfile(params.opponent).name } })
  },
  begin: () => set({ started: true }),
  reset: () => {
    Object.assign(fightInput, { move: 0, block: false, punch: false, kick: false, special: false, dodge: false })
    set({ active: false, started: false, ended: null })
  },
  end: (outcome) => !get().ended && set({ ended: outcome }),

  result() {
    const s = get()
    const energy = -Math.round(5 + s.stats.taken * 0.15)
    return s.ended === 'won'
      ? { outcome: 'won', stats: { energy, notoriety: 2 }, flags: ['wonFight'] }
      : { outcome: 'lost', stats: { energy: energy - 5 }, flags: ['lostFight'] }
  },
}))
