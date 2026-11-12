import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Character from '../../characters/Character.jsx'
import { randomLook } from '../../characters/look.js'
import { useFight, fightInput, opponentProfile } from './fightStore.js'
import { createFight, stepFight, animOf, animSpeedOf } from './fightLogic.js'
import { playerState } from '../../world/worldState.js'
import { GROUND_Y } from '../../world/layout.js'
import { useGameStore } from '../../store/gameStore.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'

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
    if (started && !store.ended) {
      const before = { p: f.p.hp, o: f.o.hp }
      stepFight(f, { ...fightInput }, dt)
      fightInput.punch = fightInput.kick = fightInput.special = fightInput.dodge = false
      for (const ev of f.events) {
        if (ev.type === 'dodged') sfx('whoosh')
        else if (ev.type === 'blocked') sfx('block')
        else if (ev.move === 'special') sfx('special')
        else if (ev.who === 'p') sfx(ev.move === 'kick' || ev.move === 'roundhouse' ? 'kick' : 'punch')
        else sfx('hurt')
      }
      const taken = before.p - f.p.hp
      const dealt = before.o - f.o.hp
      if (taken || dealt) useFight.setState({ stats: { dealt: store.stats.dealt + dealt, taken: store.stats.taken + taken } })
      hudTimer.current -= dt
      if (hudTimer.current <= 0 || taken || dealt) {
        hudTimer.current = 0.1
        useFight.setState({ hud: { php: f.p.hp, pmax: f.p.maxHp, ohp: f.o.hp, omax: f.o.maxHp, special: f.p.special, name: profile.name } })
      }
      if (f.over && !endScheduled.current) {
        endScheduled.current = true
        sfx('ko')
        setTimeout(() => sfx(f.over === 'won' ? 'win' : 'lose'), 900)
        setTimeout(() => useFight.getState().end(f.over), 1600) // let the knock-out play
      }
    }
    if (pRef.current) {
      pRef.current.position.set(center.x + f.p.x, GROUND_Y, center.z)
      pRef.current.rotation.y = Math.PI / 2
    }
    if (oRef.current) {
      oRef.current.position.set(center.x + f.o.x, GROUND_Y, center.z)
      oRef.current.rotation.y = -Math.PI / 2
    }
    setPAnim(animOf(f.p, f.over, f.over === 'won'), animSpeedOf(f.p))
    setOAnim(animOf(f.o, f.over, f.over === 'lost'), animSpeedOf(f.o))
  })

  return (
    <Suspense fallback={null}>
      <Character ref={pRef} look={playerLook} animation={pAnim.name} speed={pAnim.speed} position={[center.x - 1.6, GROUND_Y, center.z]} />
      <Character ref={oRef} look={opponentLook} animation={oAnim.name} speed={oAnim.speed} position={[center.x + 1.6, GROUND_Y, center.z]} />
    </Suspense>
  )
}
