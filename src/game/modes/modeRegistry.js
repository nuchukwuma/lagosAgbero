// Maps a mode name used in story JSON ("chase", "fight", "runner", ...) to the
// React component that plays it. Real modes are added phase by phase:
//   Phase 4 chase · Phase 7 fight · Phase 8 runner + raid · Phase 9 conductor
// Until then, StandInMode lets you pick the outcome by hand.
//
// Every mode receives { params, outcomes, onFinish } and must call
// onFinish(result) once, with a result like:
//   { outcome: "won", moneyChange: 500, flags: ["caughtDefaulter"], stats: { energy: -10 } }

import StandInMode from './StandInMode.jsx'
import FeeCollectionMode from './feeCollection/FeeCollectionMode.jsx'
import ChaseMode from './chase/ChaseMode.jsx'
import FightMode from './fight/FightMode.jsx'

export const MODES = {
  feeCollection: FeeCollectionMode,
  chase: ChaseMode,
  fight: FightMode,
}

// Modes played inside the 3D street (the player walks with joystick/keys).
export const WORLD_MODES = new Set(['feeCollection', 'chase', 'fight'])

export const PLANNED_MODES = ['chase', 'fight', 'runner', 'raid', 'conductor', 'feeCollection', 'begging', 'shop']

export function modeComponent(name) {
  return MODES[name] || StandInMode
}
