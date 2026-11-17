import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { playerState, npcRegistry } from './worldState.js'
import { traffic, LANES } from '../systems/traffic.js'
import { crowdBlobs } from './Shadows.jsx'
import { say, updateSpeech, clearSpeech } from './speech.js'
import { useStreet } from './streetState.js'
import { useGameStore } from '../store/gameStore.js'
import { campaignOf } from '../narrative/campaigns.js'
import { lineFor, patience, greetingTier } from '../systems/reactions.js'
import { randomLook } from '../characters/look.js'
import { sfx } from '../audio/audio.js'

// The street notices what you do (reactions.json):
//  - stand in front of a moving car: the driver honks, then gets out to
//    have it out with you (Confrontation.jsx: say sorry, argue or fight);
//    drivers who've heard of you lose patience sooner
//  - run into people: they shout; keep doing it and the area turns on you
//  - walk up to someone you have history with: they greet you warmly, or not
//  - win or lose a fight in public: the crowd cheers or jeers
// Speech bubbles float over whoever is talking (speech.js).

const BUMP_DISTANCE = 0.75
const BUMP_COOLDOWN = 6000
const GREET_DISTANCE = 4
const GREET_COOLDOWN = 90000

export default function ReactionDirector({ enabled }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const memo = useRef({ bumps: new Map(), recentBumps: [], greeted: new Map(), lastCheck: 0, fightSeen: 0 })
  useEffect(() => () => clearSpeech(), [])

  useFrame(() => {
    updateSpeech(camera, size.width, size.height)
    if (!enabled) return
    const now = performance.now()
    const m = memo.current
    if (now - m.lastCheck < 100) return // ten checks a second is plenty
    m.lastCheck = now
    const { game } = useGameStore.getState()
    if (!game) return
    const campaign = campaignOf(game).id
    const who = { name: game.player.name, nick: game.player.nickname }
    const p = playerState.position
    const street = game.street || {}

    // ---- cars you're standing in front of ----
    const { confront } = useStreet.getState()
    for (const v of traffic.vehicles) {
      if (!v.tag.ambient) continue
      if (v.blockedFor > 1 && !v.honked) {
        v.honked = true
        sfx('horn', v.kind === 'okada' || v.kind === 'keke' ? 1.4 : 1)
        say(lineFor('honk', campaign, who), carTop(v), { tone: 'is-angry' })
      }
      if (!v.blockedFor && v.honked && v.speed > 2 && !v.frozen) v.honked = false
      if (!confront && !v.confronted && v.blockedFor > patience(street.roadRage || 0)) {
        v.confronted = true
        v.frozen = true
        sfx('hornLong')
        const again = (street.roadRage || 0) > 0
        useStreet.getState().setConfront({
          vehicleId: v.id,
          kind: v.kind,
          again,
          line: lineFor(again ? 'driverOutAgain' : 'driverOut', campaign, who),
          look: v.riderLook || randomLook(v.id * 31 + 7, 'male'),
        })
      }
    }
    // you walked off in the middle of the argument
    if (confront && !confront.fighting) {
      const v = traffic.vehicles.find((x) => x.id === confront.vehicleId)
      if (!v || Math.hypot(p.x - v.x, p.z - LANES[v.lane].z) > 7) {
        if (v) {
          say(lineFor('walkedAway', campaign, who), carTop(v), { tone: 'is-angry' })
          release(v)
        }
        useStreet.getState().setConfront(null)
        useGameStore.getState().react('walkAway')
      }
    }

    // ---- running into people ----
    if (playerState.running || playerState.moving) {
      const fast = playerState.running
      const hit = (key, x, z) => {
        if (Math.hypot(p.x - x, p.z - z) > BUMP_DISTANCE) return
        if (now - (m.bumps.get(key) || 0) < BUMP_COOLDOWN) return
        m.bumps.set(key, now)
        if (!fast) return // walking past close is fine; barging through isn't
        sfx('bump')
        say(lineFor('bump', campaign, who), { x, y: 2.05, z }, { tone: 'is-angry' })
        m.recentBumps = [...m.recentBumps.filter((t) => now - t < 40000), now]
        if (m.recentBumps.length >= 3) {
          m.recentBumps = []
          say(lineFor('bumpTooMuch', campaign, who), { x: x + 1.5, y: 2.2, z }, { seconds: 3.5 })
          useGameStore.getState().react('bumpedTooMuch', { toast: 'People are talking about how you push through them.', count: { bumps: 1 } })
        }
      }
      for (const [id, n] of npcRegistry) hit(`npc:${id}`, n.position.x, n.position.z)
      const w = crowdBlobs.walkers
      for (let i = 0; i < w.length; i += 2) hit(`w:${i}`, w[i], w[i + 1])
    }

    // ---- people you have history with ----
    for (const [id, n] of npcRegistry) {
      if (Math.hypot(p.x - n.position.x, p.z - n.position.z) > GREET_DISTANCE) continue
      if (now - (m.greeted.get(id) || -Infinity) < GREET_COOLDOWN) continue
      m.greeted.set(id, now)
      const tier = greetingTier(id, game.stats)
      if (tier) say(lineFor(tier === 'warm' ? 'greetWarm' : 'greetCold', campaign, who), personTop(n), { seconds: 3, tone: tier === 'warm' ? 'is-warm' : '' })
    }

    // ---- the crowd saw your fight ----
    const fight = useStreet.getState().lastFight
    if (fight && fight.at !== m.fightSeen) {
      m.fightSeen = fight.at
      const w = crowdBlobs.walkers
      const kind = fight.outcome === 'won' ? 'crowdCheer' : 'crowdJeer'
      sfx('crowd')
      for (let k = 0; k < Math.min(2, w.length / 2); k++) say(lineFor(kind, campaign, who), { x: w[k * 2], y: 2.05, z: w[k * 2 + 1] }, { seconds: 3 })
      if (!w.length) say(lineFor(kind, campaign, who), { x: p.x + 2, y: 2.2, z: p.z }, { seconds: 3 })
    }
  })
  return null
}

export function release(v) {
  v.frozen = false
  v.blockedFor = 0
  v.honked = false
}

const carTop = (v) => () => ({ x: v.x, y: 2.6, z: LANES[v.lane].z })
const personTop = (n) => () => ({ x: n.position.x, y: 2.1, z: n.position.z })
