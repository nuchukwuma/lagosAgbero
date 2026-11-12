// State of one chase on foot after a fleeing vehicle (a defaulter's danfo).
// The director (inside the 3D canvas) moves the target and checks distance;
// the overlay shows stamina, distance and the GRAB button.
//
// Story params (startMode "chase"):
//   target      named driver id ("driver_biodun" or "biodun")
//   difficulty  1 (gentle) .. 3 (hard): how fast the vehicle weaves through go-slow
//   kind        vehicle kind (default "danfo")
//   escapeX     the vehicle gets away once it passes this x (default -52, past the motor park)
//   timeLimit   seconds (default 45)

import { create } from 'zustand'

export const useChase = create((set, get) => ({
  active: false,
  started: false,
  params: {},
  stamina: 100,
  maxStamina: 100,
  staminaUsed: 0,
  distance: null, // metres between the player and the vehicle's side
  canGrab: false,
  timeLeft: 45,
  ended: null, // 'won' | 'lost'
  reason: '',
  bumps: 0,

  start(params, stats) {
    const energy = stats?.energy ?? 70
    const max = Math.round(40 + energy * 0.6)
    set({ active: true, started: false, params, stamina: max, maxStamina: max, staminaUsed: 0, distance: null, canGrab: false, timeLeft: params.timeLimit ?? 45, ended: null, reason: '', bumps: 0 })
  },
  begin: () => set({ started: true }),
  reset: () => set({ active: false, started: false, ended: null }),
  end: (outcome, reason) => !get().ended && set({ ended: outcome, reason, canGrab: false }),
  grab: () => get().canGrab && get().end('won', 'grabbed'),

  result() {
    const s = get()
    const energyCost = Math.round(5 + s.staminaUsed * 0.2)
    return s.ended === 'won'
      ? { outcome: 'won', moneyChange: 500, flags: ['caughtDefaulter'], stats: { energy: -energyCost, notoriety: 1 } }
      : { outcome: 'lost', flags: ['defaulterEscaped'], stats: { energy: -energyCost } }
  },
}))
