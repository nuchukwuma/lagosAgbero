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
import StealthMode from './stealth/StealthMode.jsx'
import ShrineHeistMode from './stealth/ShrineHeistMode.jsx'
import RaidEscapeMode from './stealth/RaidEscapeMode.jsx'
import WireSprintMode from './wireSprint/WireSprintMode.jsx'
import TurfMode from './turf/TurfMode.jsx'
import { CreekRunMode, CustomsBreakoutMode, CartDashMode, ConvoyEscortMode } from './course/CourseModes.jsx'
import { PenthouseRaidMode, WarehouseHeistMode, ExamSneakMode, ServerBreakMode, HostelDashMode, PaperRelayMode, DroneDodgeMode } from './stealth/MissionModes.jsx'

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
  sneak: StealthMode, // Back Gate: a 3D stealth mission on the campus at night
  shrineHeist: ShrineHeistMode, // Steal Untouched: the rival shrine, in the bush round the village at night
  raidEscape: RaidEscapeMode, // EFCC Raid Escape: inside the Rich Street duplex, operatives at the door
  penthouseRaid: PenthouseRaidMode, // Abuja: the Maitama penthouse (cameras, a safe to crack, heavy gold)
  warehouseHeist: WarehouseHeistMode, // Computer Village: container aisles, night watchmen
  examSneak: ExamSneakMode, // campus: move in an invigilator's sightline and it's over
  serverBreak: ServerBreakMode, // Lekki: breakers and drives before the lockdown
  hostelDash: HostelDashMode, // campus at night: the meet-up to your hostel, past security
  paperRelay: PaperRelayMode, // campus at night: three sealed packets to three drop zones before the bell
  droneDodge: DroneDodgeMode, // Lekki at night: Pearl Estate, its gate, security and drones overhead
  wireSprint: WireSprintMode, // Beat-the-Bet Wire Sprint: a race across a Wuse street grid (its own 3D scene)
  // course runs (modes/course): down a winding way in one piece, each in a 3D scene of its own
  creekRun: CreekRunMode, // Port Harcourt: a speedboat through the creeks, rival boats behind
  customsBreakout: CustomsBreakoutMode, // Computer Village: a container truck through the customs lines
  cartDash: CartDashMode, // Computer Village: a loaded pushcart through the market lanes
  convoyEscort: ConvoyEscortMode, // Abuja: clear the road ahead of the VIP convoy
  turfBrawl: TurfMode, // Port Harcourt: three flags on a creekside yard, shove the other crew into the creek
}

// Modes drawn as a full-screen 2D scene over the frozen street (the street HUD steps aside).
export const FULLSCREEN_MODES = new Set(['dance', ...Object.keys(ARCADE_MODES)])

// Modes played inside the 3D street (the player walks with joystick/keys).
export const WORLD_MODES = new Set(['feeCollection', 'chase', 'fight', 'runner', 'conductor', 'drive', 'sneak', 'shrineHeist', 'raidEscape', 'wireSprint', 'penthouseRaid', 'warehouseHeist', 'examSneak', 'serverBreak', 'hostelDash', 'paperRelay', 'droneDodge', 'creekRun', 'customsBreakout', 'cartDash', 'convoyEscort', 'turfBrawl'])

export { worldForMode } from './modeWorlds.js' // modes with a world of their own (Back Gate: the campus)

export const PLANNED_MODES = [...Object.keys(ARCADE_MODES), 'creekRun', 'customsBreakout', 'cartDash', 'convoyEscort', 'droneDodge', 'turfBrawl', 'penthouseRaid', 'warehouseHeist', 'examSneak', 'serverBreak', 'hostelDash', 'paperRelay', 'wireSprint', 'sneak', 'shrineHeist', 'raidEscape', 'chase', 'fight', 'runner', 'raid', 'conductor', 'feeCollection', 'begging', 'rally', 'initiation', 'drive', 'bluff', 'exam', 'haggle', 'dance', 'shop']

export function modeComponent(name) {
  return MODES[name] || StandInMode
}
