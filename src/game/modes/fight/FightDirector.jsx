import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import { useFight, fightInput, opponentProfile } from './fightStore.js'
import { createFight, stepFight, animOf, animSpeedOf } from './fightLogic.js'
import { playerState, shake } from '../../world/worldState.js'
import { GROUND_Y } from '../../world/layout.js'
import { useGameStore } from '../../store/gameStore.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'
import { loadClips } from '../../characters/clipLoader.js'
import * as THREE from 'three'
import FightFX, { impact } from './FightFX.jsx'

// a split-second freeze when a blow lands gives it weight (seconds)
const HIT_STOP = { punch: 0.06, kick: 0.09, special: 0.16 }
const SQUASH_TIME = 0.16
const hitPoint = new THREE.Vector3()

// fetched before the first punch, so no move starts with a frozen frame
const FIGHT_CLIPS = ['fightIdle', 'punch', 'kick', 'roundhouse', 'block', 'blockOutward', 'hit', 'knockedOut', 'cheer', 'walk']

// Runs a fight in the street where the player stands: two fighters face
// each other along the road (player on the left), the camera films from the
// side like a fighting game.

function useAnim(initial) {
  const [anim, setAnim] = useState(initial)
  const ref = useRef(initial)
  const update = (name, speed) => {
    if (ref.current.name !== name || ref.current.speed !== speed) {
      ref.current = { name, speed }
      setAnim(ref.current)
    }
  }
  return [anim, update]
}

export default function FightDirector({ playerLook }) {
  const params = useFight((s) => s.params)
  const started = useFight((s) => s.started)
  const stats = useGameStore((s) => s.game?.stats)
  const profile = opponentProfile(params.opponent)
  const opponentLook = useMemo(() => {
    const base = profile.character ? characters[profile.character]?.look : randomLook(profile.seed || 5, 'male')
    return { ...base, ...(profile.lookOverride || {}) }
  }, [profile])

  const center = useMemo(() => ({ x: playerState.position.x, z: playerState.position.z }), [])
  const fight = useRef(null)
  if (!fight.current) fight.current = createFight(profile, { energy: stats?.energy ?? 70, notoriety: stats?.notoriety ?? 0, difficulty: params.difficulty ?? 1 })
  const pRef = useRef()
  const oRef = useRef()
  const [pAnim, setPAnim] = useAnim({ name: 'fightIdle', speed: 1 })
  const [oAnim, setOAnim] = useAnim({ name: 'fightIdle', speed: 1 })
  const hudTimer = useRef(0)
  const endScheduled = useRef(false)
  const hitStop = useRef(0)
  const squash = useRef({ p: 0, o: 0 }) // seconds left of each fighter's squash

  useEffect(() => {
    loadClips(FIGHT_CLIPS, 'kenney').catch(() => {})
  }, [])

  useEffect(() => {
    playerState.fightView = center
    return () => {
      playerState.fightView = null
      const f = fight.current
      playerState.teleport = { x: center.x + (f?.p.x ?? 0), z: center.z, facing: Math.PI / 2 }
    }
  }, [center])

  useFrame((_, raw) => {
    const f = fight.current
    const dt = Math.min(raw, 0.05)
    const store = useFight.getState()
    squash.current.p = Math.max(0, squash.current.p - dt)
    squash.current.o = Math.max(0, squash.current.o - dt)
    if (hitStop.current > 0) hitStop.current -= dt // the blow's freeze: the fight holds, the burst plays
    else if (started && !store.ended) {
      const before = { p: f.p.hp, o: f.o.hp }
      stepFight(f, { ...fightInput }, dt)
      fightInput.punch = fightInput.kick = fightInput.special = fightInput.dodge = false
      for (const ev of f.events) {
        if (ev.type === 'hit' || ev.type === 'blocked') {
          // where it landed: on the one who took it, on the side facing the attacker
          const victim = ev.who === 'player' ? f.o : f.p
          const side = ev.who === 'player' ? -1 : 1
          const high = ev.move === 'kick' ? 0.75 : 1.0
          hitPoint.set(center.x + victim.x + side * 0.28, GROUND_Y + high, center.z)
          const kind = ev.type === 'blocked' ? 'block' : ev.move === 'special' ? 'special' : ev.move === 'kick' ? 'kick' : 'punch'
          impact(hitPoint, { kind })
          if (ev.type === 'hit') {
            hitStop.current = HIT_STOP[kind] || 0.06
            squash.current[ev.who === 'player' ? 'o' : 'p'] = SQUASH_TIME
          }
        }
        // a jolt on every clean hit: bigger for kicks and the special
        if (ev.type === 'hit') shake(ev.move === 'special' ? 0.32 : ev.move === 'kick' ? 0.16 : 0.09, ev.move === 'special' ? 0.45 : 0.18)
        if (ev.type === 'dodged') sfx('whoosh')
        else if (ev.type === 'blocked') sfx('block')
        else if (ev.move === 'special') sfx('special')
        else if (ev.who === 'player') sfx(ev.move === 'kick' ? 'kick' : 'punch') // you landed one
        else sfx('hurt')
      }
      const taken = before.p - f.p.hp
      const dealt = before.o - f.o.hp
      if (taken || dealt) useFight.setState({ stats: { dealt: store.stats.dealt + dealt, taken: store.stats.taken + taken } })
      hudTimer.current -= dt
      if (hudTimer.current <= 0 || taken || dealt) {
        hudTimer.current = 0.1
        useFight.setState({ hud: { php: f.p.hp, pmax: f.p.maxHp, ohp: f.o.hp, omax: f.o.maxHp, special: f.p.special, name: profile.name, combo: f.p.combo } })
      }
      if (f.over && !endScheduled.current) {
        endScheduled.current = true
        sfx('ko')
        shake(0.4, 0.6)
        setTimeout(() => sfx(f.over === 'won' ? 'win' : 'lose'), 900)
        setTimeout(() => useFight.getState().end(f.over), 1600) // let the knock-out play
      }
    }
    // a fighter who's just been hit squashes like a rubber toy, then springs back
    const squashed = (t) => {
      const k = Math.sin((t / SQUASH_TIME) * Math.PI) * 0.18
      return [1 + k, 1 - k, 1 + k]
    }
    if (pRef.current) {
      pRef.current.position.set(center.x + f.p.x, GROUND_Y, center.z)
      pRef.current.rotation.y = Math.PI / 2
      pRef.current.scale.set(...squashed(squash.current.p))
    }
    if (oRef.current) {
      oRef.current.position.set(center.x + f.o.x, GROUND_Y, center.z)
      oRef.current.rotation.y = -Math.PI / 2
      oRef.current.scale.set(...squashed(squash.current.o))
    }
    setPAnim(animOf(f.p, f.over, f.over === 'won'), animSpeedOf(f.p))
    setOAnim(animOf(f.o, f.over, f.over === 'lost'), animSpeedOf(f.o))
  })

  return (
    <Suspense fallback={null}>
      <FightFX />
      <Character ref={pRef} look={playerLook} animation={pAnim.name} speed={pAnim.speed} position={[center.x - 1.6, GROUND_Y, center.z]} />
      <Character ref={oRef} look={opponentLook} animation={oAnim.name} speed={oAnim.speed} position={[center.x + 1.6, GROUND_Y, center.z]} />
    </Suspense>
  )
}
