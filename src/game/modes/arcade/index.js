// The arcade mini-games, three for each story (see docs/minigames.md).
// Each one is its own story mode: "startMode": "draughts", and so on.
import { makeArcadeMode } from './ArcadeHost.jsx'
import change from './games/change.js'
import draughts from './games/draughts.js'
import traffic from './games/traffic.js'
import ayo from './games/ayo.js'
import palmClimb from './games/palmClimb.js'
import fakeParts from './games/fakeParts.js'
import akara from './games/akara.js'
import penalty from './games/penalty.js'
import posters from './games/posters.js'
import ballots from './games/ballots.js'
import riceQueue from './games/riceQueue.js'
import pepperSoup from './games/pepperSoup.js'
import barRush from './games/barRush.js'
import whot from './games/whot.js'
import escape from '../platformer/escape.js'

export const ARCADE_GAMES = [escape, change, draughts, traffic, ayo, palmClimb, fakeParts, akara, penalty, posters, ballots, riceQueue, pepperSoup, barRush, whot]

export { ARCADE_BY_STORY } from './ids.js'

export const ARCADE_MODES = Object.fromEntries(ARCADE_GAMES.map((g) => [g.id, makeArcadeMode(g)]))
