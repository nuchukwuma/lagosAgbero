import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState, playGesture } from './worldState.js'
import { findsFor, findsKey, findColour } from '../systems/finds.js'
import { useGameStore } from '../store/gameStore.js'
import { sfx } from '../audio/audio.js'
import { GROUND_Y } from './layout.js'

// Street finds during free roam: a note or small item turning slowly above
// a soft ring on the ground. Walk over one to pick it up.
// (Where they lie and what they give: src/game/systems/finds.js.)

const REACH = 1.0
const noteGeo = new THREE.BoxGeometry(0.42, 0.22, 0.03)
const ringGeo = new THREE.RingGeometry(0.34, 0.46, 20)
ringGeo.rotateX(-Math.PI / 2)
const ringMat = new THREE.MeshBasicMaterial({ color: '#f2c300', transparent: true, opacity: 0.55, depthWrite: false })
const materials = new Map()
const materialFor = (kind) => {
  if (!materials.has(kind)) materials.set(kind, new THREE.MeshBasicMaterial({ color: findColour(kind) }))
  return materials.get(kind)
}

function Find({ find, onTake }) {
  const note = useRef()
  const ring = useRef()
  const done = useRef(false)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + find.id * 1.7
    if (note.current) {
      note.current.position.y = 0.62 + Math.sin(t * 2.2) * 0.08
      note.current.rotation.y = t * 1.6
    }
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12)
    if (done.current) return
    const p = playerState.position
    if (Math.hypot(p.x - find.x, p.z - find.z) < REACH) {
      done.current = true
      onTake(find)
    }
  })
  return (
    <group position={[find.x, GROUND_Y, find.z]}>
      <mesh ref={note} geometry={noteGeo} material={materialFor(find.kind)} position={[0, 0.62, 0]} rotation={[0.25, 0, 0]} />
      <mesh ref={ring} geometry={ringGeo} material={ringMat} position={[0, 0.03, 0]} />
    </group>
  )
}

export default function Pickups({ layout, game }) {
  const key = findsKey(layout.id, game)
  const taken = game.finds?.key === key ? game.finds.taken.length : 0
  // eslint-disable-next-line react-hooks/exhaustive-deps -- finds only change with the day, chapter, world, or when one is taken
  const finds = useMemo(() => findsFor(layout, game), [layout, key, taken])
  const onTake = (find) => {
    if (!useGameStore.getState().pickUpFind(find, layout.id)) return
    playGesture('pickUp', { speed: 1.5, seconds: 0.7 })
    sfx(find.amount ? 'coin' : 'notify')
  }
  return finds.map((f) => <Find key={`${key}:${f.id}`} find={f} onTake={onTake} />)
}
