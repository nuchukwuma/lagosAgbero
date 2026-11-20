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
import RunnerMode from './runner/RunnerMode.jsx'
import ConductorMode from './conductor/ConductorMode.jsx'
import BeggingMode from './begging/BeggingMode.jsx'
import RallyMode from './rally/RallyMode.jsx'
import InitiationMode from './initiation/InitiationMode.jsx'
import DriveMode from './drive/DriveMode.jsx'
import BluffMode from './bluff/BluffMode.jsx'
import HaggleMode from './haggle/HaggleMode.jsx'
import DanceMode from './dance/DanceMode.jsx'
import { ARCADE_MODES } from './arcade/index.js'

export const MODES = {
  feeCollection: FeeCollectionMode,
  chase: ChaseMode,
  fight: FightMode,
  runner: RunnerMode,
  conductor: ConductorMode,
  begging: BeggingMode,
  rally: RallyMode,
  initiation: InitiationMode,
  drive: DriveMode,
  bluff: BluffMode,
  exam: InitiationMode, // the same timed-question screen, with a question bank
  haggle: HaggleMode, // selling at a stall: name your price, read the customer
  dance: DanceMode, // a dance battle on a stage, the crowd behind
  ...ARCADE_MODES, // the 2D mini-games: three per story (arcade/index.js)
}

// Modes drawn as a full-screen 2D scene over the frozen street (the street HUD steps aside).
export const FULLSCREEN_MODES = new Set(['dance', ...Object.keys(ARCADE_MODES)])

// Modes played inside the 3D street (the player walks with joystick/keys).
export const WORLD_MODES = new Set(['feeCollection', 'chase', 'fight', 'runner', 'conductor', 'drive'])

export const PLANNED_MODES = [...Object.keys(ARCADE_MODES), 'chase', 'fight', 'runner', 'raid', 'conductor', 'feeCollection', 'begging', 'rally', 'initiation', 'drive', 'bluff', 'exam', 'haggle', 'dance', 'shop']

export function modeComponent(name) {
  return MODES[name] || StandInMode
}
