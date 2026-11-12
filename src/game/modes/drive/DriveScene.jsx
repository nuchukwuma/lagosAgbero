import { Suspense, useEffect, useMemo, useReducer, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import Vehicle from '../../vehicles/Vehicle.jsx'
import Character from '../../characters/Character.jsx'
import { Model } from '../../world/Model.jsx'
import Sign from '../../world/Sign.jsx'
import { BusShelter } from '../../world/StreetBits.jsx'
import { generateFill } from '../../world/cityFill.js'
import { buildStaticBatches } from '../../world/staticBatch.js'
import { mergePrims, PRIM_MATERIAL } from '../../world/primGeometry.js'
import { earthTexture, paverTexture } from '../../world/textures.js'
import { getAsset } from '../../../assets/assetManifest.js'
import { randomLook } from '../../characters/look.js'
import characters from '../../data/characters.json'
import { useDrive, readDriveInput, driveInput } from './driveStore.js'
import { createDrive, stepDrive, placeAt, driveResult, SHOULDER, MAX_SPEED, kmh, upcoming } from './driveLogic.js'
import { playerState } from '../../world/worldState.js'
import { useGameStore } from '../../store/gameStore.js'
import { sfx, engine } from '../../audio/audio.js'

// The drive: a Lagos expressway that never ends. The bus goes towards -Z
// (world z = -distance). Roadside scenery is two 120 m segments built once
// (merged meshes) and repeated; places (stops, filling stations,
// checkpoints) and traffic come from driveLogic.js.

const SEG = 120
const Y = 0.02

// ---------- road surface ----------
function roadTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#4a4a4f'
  g.fillRect(0, 0, 256, 512)
  for (let i = 0; i < 2200; i++) {
    const v = 60 + Math.floor(Math.random() * 40)
    g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`
    g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2)
  }
  // patches, cracks and potholes
  for (let i = 0; i < 6; i++) {
    g.fillStyle = `rgba(30,30,32,${0.25 + Math.random() * 0.2})`
    g.beginPath()
    g.ellipse(Math.random() * 256, Math.random() * 512, 8 + Math.random() * 18, 6 + Math.random() * 14, Math.random() * 3, 0, 7)
    g.fill()
  }
  // lane markings: the road texture spans x -5.2..5.2 (10.4 m) over 256 px
  const px = (x) => ((x + 5.2) / 10.4) * 256
  g.fillStyle = '#e8e2c8'
  for (const x of [-1.7, 1.7]) for (let y = 0; y < 512; y += 128) g.fillRect(px(x) - 3, y, 6, 64)
  g.fillStyle = '#e0b400'
  g.fillRect(px(-5.0), 0, 5, 512)
  g.fillStyle = '#e8e2c8'
  g.fillRect(px(5.0) - 5, 0, 5, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

const TILE = 40 // the road texture repeats every 40 m
function Road() {
  const ref = useRef()
  const tex = useMemo(() => roadTexture(), [])
  const pav = useMemo(() => paverTexture(), [])
  const earth = useMemo(() => earthTexture(), [])
  const geos = useMemo(() => {
    const L = 480
    const strip = (x0, x1, uvx, uvz) => {
      const g = new THREE.PlaneGeometry(x1 - x0, L)
      g.rotateX(-Math.PI / 2)
      g.translate((x0 + x1) / 2, 0, 0)
      const uv = g.attributes.uv
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvx, uv.getY(i) * uvz)
      return g
    }
    return {
      road: strip(-5.2, 5.2, 1, L / TILE),
      shoulder: strip(5.2, 8.2, 1, L / 4),
      pavR: strip(8.2, 11.5, 1, L / 3),
      pavL: strip(-8.4, -5.2, 1, L / 3),
      earth: strip(-90, 90, 24, L / 7),
      kerb: (() => {
        const g = new THREE.BoxGeometry(0.25, 0.18, L)
        return g
      })(),
    }
  }, [])
  useFrame(({ camera }) => {
    // snap to the texture tile so markings stay put in the world
    if (ref.current) ref.current.position.z = Math.round(camera.position.z / TILE) * TILE - 160
  })
  return (
    <group ref={ref}>
      <mesh geometry={geos.earth} position-y={-0.05}>
        <meshLambertMaterial map={earth} color="#b07a4c" />
      </mesh>
      <mesh geometry={geos.road} position-y={0.01}>
        <meshLambertMaterial map={tex} />
      </mesh>
      <mesh geometry={geos.shoulder} position-y={0.012}>
        <meshLambertMaterial map={pav} color="#7d7a74" />
      </mesh>
      <mesh geometry={geos.pavR} position-y={0.14}>
        <meshLambertMaterial map={pav} color="#a39d93" />
      </mesh>
      <mesh geometry={geos.pavL} position-y={0.14}>
        <meshLambertMaterial map={pav} color="#a39d93" />
      </mesh>
      {[8.2, -5.2].map((x) => (
        <mesh key={x} geometry={geos.kerb} position={[x, 0.09, 0]}>
          <meshLambertMaterial color="#c9c3b8" />
        </mesh>
      ))}
    </group>
  )
}

// ---------- roadside segments ----------
function segmentLayout(seed) {
  return {
    bounds: { minX: -40, maxX: 40, minZ: -SEG, maxZ: 0 },
    rows: [
      { from: [-15.5, 0], to: [-15.5, -SEG], face: 90, set: seed % 2 ? 'mixed' : 'houses', gap: 1.4, seed: seed * 7 + 1, jitter: 0.8 },
      { from: [20, -SEG], to: [20, 0], face: 270, set: seed % 2 ? 'houses' : 'industrial', gap: 1.4, seed: seed * 7 + 2, jitter: 0.8 },
      { from: [-34, 0], to: [-34, -SEG], face: 90, set: 'offices', gap: 4, seed: seed * 7 + 3, jitter: 3 },
      { from: [40, -SEG], to: [40, 0], face: 270, set: 'offices', gap: 4, seed: seed * 7 + 4, jitter: 3 },
    ],
    clutter: [
      { rect: [-10.6, -SEG, 2.2, SEG], count: 10, kinds: ['kiosk', 'umbrella', 'kegs', 'drums', 'bench', 'signboard', 'okada', 'crates'], seed: seed * 11 + 1, face: 90, spin: 15 },
      { rect: [12, -SEG, 3, SEG], count: 9, kinds: ['kiosk', 'umbrella', 'kegs', 'tyres', 'generator', 'signboard', 'waterTank'], seed: seed * 11 + 2, face: 270, spin: 15 },
    ],
  }
}

function segmentPoles() {
  const items = []
  for (let z = -8; z > -SEG; z -= 24) {
    items.push({ position: [-6.2, Y + 0.14, z], rotation: 0, scale: 1.5 })
    items.push({ position: [9.6, Y + 0.14, z - 12], rotation: 0, scale: 1.5 })
  }
  return [{ model: 'electricityPoleSingle', items }, { model: 'streetLamp', items: [-30, -90].map((z) => ({ position: [8.6, Y + 0.14, z], rotation: 270, scale: 1.2 })) }]
}

function useSegments() {
  const fills = useMemo(() => [1, 2].map((s) => generateFill(segmentLayout(s), [], [])), [])
  const groups = useMemo(() => fills.map((f) => [...f.groups, ...segmentPoles()]), [fills])
  const names = useMemo(() => [...new Set(groups.flat().map((g) => g.model))].filter((n) => getAsset(n).available), [groups])
  const gltfs = useGLTF(names.map((n) => getAsset(n).url))
  return useMemo(() => {
    const map = new Map(names.map((n, i) => [n, gltfs[i]]))
    return groups.map((g, i) => ({ batches: buildStaticBatches(g, map), props: mergePrims(fills[i].prims, 0) }))
  }, [groups, names, gltfs, fills])
}

function Segments() {
  const segments = useSegments()
  const refs = useRef([])
  const SLOTS = 5
  useFrame(({ camera }) => {
    const first = Math.floor(-camera.position.z / SEG) - 1
    for (let k = 0; k < SLOTS; k++) {
      const g = refs.current[k]
      if (!g) continue
      const i = first + k
      g.position.z = -i * SEG
      // alternate the two segment designs
      g.children.forEach((c) => (c.visible = c.userData.seg === ((i % 2) + 2) % 2))
    }
  })
  return Array.from({ length: SLOTS }, (_, k) => (
    <group key={k} ref={(g) => (refs.current[k] = g)}>
      {segments.map((s, si) => (
        <group key={si} userData={{ seg: si }}>
          {s.batches.map((b, i) => (
            <mesh key={i} geometry={b.geometry} material={b.material} />
          ))}
          {s.props.map((g, i) => (
            <mesh key={`p${i}`} geometry={g} material={PRIM_MATERIAL} />
          ))}
        </group>
      ))}
    </group>
  ))
}

// ---------- places ----------
const canopyMat = new THREE.MeshLambertMaterial({ color: '#e8e2d0' })
const canopyEdge = new THREE.MeshLambertMaterial({ color: '#c0392b' })
const pumpMat = new THREE.MeshLambertMaterial({ color: '#2c5aa0' })
const barrierMat = new THREE.MeshLambertMaterial({ color: '#d63a2a' })
const whiteMat = new THREE.MeshLambertMaterial({ color: '#f2f2f2' })

function FuelStation({ z }) {
  return (
    <group position={[0, Y, z]}>
      <mesh material={canopyMat} position={[12.5, 4.6, 0]}>
        <boxGeometry args={[7, 0.4, 16]} />
      </mesh>
      <mesh material={canopyEdge} position={[12.5, 4.3, 0]}>
        <boxGeometry args={[7.1, 0.25, 16.1]} />
      </mesh>
      {[-5, 5].map((pz) => (
        <group key={pz}>
          <mesh material={whiteMat} position={[12.5, 2.2, pz]}>
            <boxGeometry args={[0.35, 4.4, 0.35]} />
          </mesh>
          <mesh material={pumpMat} position={[11.4, 0.85, pz]}>
            <boxGeometry args={[0.7, 1.7, 0.5]} />
          </mesh>
        </group>
      ))}
      <Sign at={[9.2, -9.5, 270]} y={4.2} size={[4.6, 1.4]} lines={['WAHALA OIL', 'PMS ₦ DON CHANGE AGAIN']} bg="#c0392b" fg="#ffffff" post />
    </group>
  )
}

function BusStop({ place, idx }) {
  const people = Math.min(place.served ? 0 : place.waiting, 5)
  return (
    <group>
      <BusShelter at={[10.2, -place.d, 270]} />
      <Sign at={[9.0, -place.d - 4.2, 270]} y={3.3} size={[3.6, 0.7]} lines={[place.name.toUpperCase()]} bg="#f2c300" fg="#1a1408" post />
      {Array.from({ length: people }, (_, i) => (
        <Suspense key={i} fallback={null}>
          <Character look={randomLook(idx * 13 + i * 7 + 3)} animation={i % 2 ? 'talk' : 'idle'} position={[9.3 + (i % 2) * 0.7, Y + 0.14, -place.d - 2.4 + i * 1.1]} rotation-y={-Math.PI / 2} />
        </Suspense>
      ))}
    </group>
  )
}

function Checkpoint({ place }) {
  const officer = characters.bassey?.look
  const open = place.state !== 'ahead'
  return (
    <group position={[0, Y, -place.d]}>
      {/* barrier across two lanes: the bus must stop by it, or go round */}
      <group rotation-y={open ? 0.9 : 0} position={[-1.7, 0, 0]}>
        <mesh material={barrierMat} position={[1.8, 1.0, 0]}>
          <boxGeometry args={[4.2, 0.18, 0.18]} />
        </mesh>
      </group>
      <mesh material={whiteMat} position={[-1.8, 0.5, 0]}>
        <boxGeometry args={[0.25, 1.0, 0.25]} />
      </mesh>
      {[-4.4, -3.6, 2.4, 3.2].map((x) => (
        <Model key={x} name="cone" position={[x, 0, 1.5]} />
      ))}
      <Model name="taskForceVan" position={[-12.4, 0.14, 4]} rotation-y={Math.PI} />
      <Sign at={[-9.4, 6, 90]} y={3.6} size={[5, 1]} lines={['LETS TASK FORCE', 'CHECKPOINT · STOP!']} bg="#1e8449" fg="#ffffff" post />
      {officer && (
        <Suspense fallback={null}>
          <Character look={officer} animation="argue" position={[-3.2, 0, -1.8]} rotation-y={Math.PI / 2} />
          <Character look={{ ...officer, skin: '#4e2f1d', height: 1.02 }} animation="idle" position={[4.6, 0, 1.6]} rotation-y={-Math.PI / 2} />
        </Suspense>
      )}
    </group>
  )
}

function Places({ drive }) {
  const [, rerender] = useReducer((n) => n + 1, 0)
  const near = useRef('')
  useFrame(() => {
    const key = drive.places
      .filter((p) => Math.abs(p.d - drive.d) < 220)
      .map((p) => `${p.d}:${p.served ? 1 : 0}:${p.waiting}:${p.state || ''}`)
      .join('|')
    if (key !== near.current) {
      near.current = key
      rerender()
    }
  })
  return drive.places
    .filter((p) => Math.abs(p.d - drive.d) < 220)
    .map((p, i) =>
      p.type === 'stop' ? <BusStop key={p.d} place={p} idx={i} /> : p.type === 'fuel' ? <FuelStation key={p.d} z={-p.d} /> : <Checkpoint key={p.d} place={p} />,
    )
}

// ---------- traffic ----------
function Car({ car }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.set(car.x, Y, -car.d)
    ref.current.rotation.y = Math.PI + (car.targetX - car.x) * 0.08
  })
  const look = useMemo(() => (car.kind === 'okada' || car.kind === 'keke' ? randomLook(car.id * 17) : null), [car])
  return <Vehicle ref={ref} kind={car.kind} riderLook={look} color={car.kind === 'keke' ? '#e8c21c' : null} position={[car.x, Y, -car.d]} rotation-y={Math.PI} />
}

function Traffic({ drive }) {
  const [, rerender] = useReducer((n) => n + 1, 0)
  const ids = useRef('')
  useFrame(() => {
    const k = drive.cars.map((c) => c.id).join(',')
    if (k !== ids.current) {
      ids.current = k
      rerender()
    }
  })
  return drive.cars.map((c) => <Car key={c.id} car={c} />)
}

const sirenRed = new THREE.MeshBasicMaterial({ color: '#ff2a2a' })
const sirenBlue = new THREE.MeshBasicMaterial({ color: '#2a6bff' })

function Police({ drive }) {
  const ref = useRef()
  const red = useRef()
  const blue = useRef()
  const x = useRef(0)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.visible = Boolean(drive.chase)
    if (!drive.chase) return
    x.current += (drive.x - x.current) * 0.04
    g.position.set(x.current, Y, -(drive.d - drive.chase.gap))
    const on = Math.floor(clock.elapsedTime * 6) % 2
    if (red.current) red.current.visible = on === 0
    if (blue.current) blue.current.visible = on === 1
  })
  return (
    <group ref={ref} visible={false}>
      <Vehicle kind="taskForceVan" rotation-y={Math.PI} />
      <mesh ref={red} material={sirenRed} position={[-0.4, 2.45, 0.6]}>
        <boxGeometry args={[0.5, 0.18, 0.3]} />
      </mesh>
      <mesh ref={blue} material={sirenBlue} position={[0.4, 2.45, 0.6]}>
        <boxGeometry args={[0.5, 0.18, 0.3]} />
      </mesh>
    </group>
  )
}

// ---------- the scene ----------
export default function DriveScene() {
  const params = useDrive((s) => s.params)
  const started = useDrive((s) => s.started)
  const drive = useMemo(
    () =>
      createDrive({
        seed: params.seed ?? Math.floor(Math.random() * 9999),
        length: params.length ?? 2400,
        stops: params.stops ?? 5,
        fuel: params.fuel ?? 55,
        police: params.police !== false,
        checkpoints: params.checkpoints ?? 1,
        difficulty: params.difficulty ?? 1,
        fare: params.fare ?? 300,
      }),
    [params],
  )
  const bus = useRef()
  const hudTimer = useRef(0)
  const engineTimer = useRef(0)
  const lastPrompt = useRef(null)

  useEffect(() => {
    useDrive.setState({ drive })
    playerState.driveView = { x: drive.x, z: 0, yaw: 0 }
    return () => {
      engine(null)
      playerState.driveView = null
    }
  }, [drive])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const store = useDrive.getState()
    if (started && !store.ended && !store.paused) {
      const input = readDriveInput()
      driveInput.horn = false
      stepDrive(drive, input, dt)
      for (const ev of drive.events) {
        if (ev.type === 'horn') sfx('horn', 0.9)
        else if (ev.type === 'crash') sfx('crash')
        else if (ev.type === 'scrape') sfx('bump')
        else if (ev.type === 'board') sfx('coin')
        else if (ev.type === 'siren') sfx('siren')
        else if (ev.type === 'chase') {
          sfx('whistle')
          store.toast = null
          useDrive.setState({ toast: { text: 'POLICE! Task Force dey pursue you!', kind: 'warn', at: performance.now() } })
        } else if (ev.type === 'escaped') useDrive.setState({ toast: { text: 'You don lose them!', kind: 'good', at: performance.now() } })
        else if (ev.type === 'missedStop') useDrive.setState({ toast: { text: `You pass ${ev.name}! ${ev.count} passenger(s) shout and jump down. Half fare.`, kind: 'warn', at: performance.now() } })
        else if (ev.type === 'stopDone') useDrive.setState({ toast: { text: `${ev.name}: done. Oya move!`, kind: 'good', at: performance.now() } })
      }
      // engine sound
      engineTimer.current -= dt
      if (engineTimer.current <= 0) {
        engineTimer.current = 0.1
        engine(drive.fuel > 0 ? 0.08 + (drive.speed / MAX_SPEED) * 0.9 + input.gas * 0.1 : 0)
      }
      // what the HUD needs, ten times a second
      hudTimer.current -= dt
      if (hudTimer.current <= 0) {
        hudTimer.current = 0.1
        const here = drive.halted
        const prompt = here && (here.type === 'fuel' || (here.type === 'checkpoint' && here.state === 'ahead')) ? here : null
        if (prompt !== lastPrompt.current) {
          lastPrompt.current = prompt
          if (prompt) sfx('open')
        }
        useDrive.setState({
          prompt,
          hud: {
            kmh: kmh(drive.speed),
            fuel: drive.fuel,
            damage: drive.damage,
            passengers: drive.passengers.length,
            fares: drive.fares,
            spent: drive.spent,
            progress: drive.d / drive.length,
            chase: drive.chase ? Math.max(0, Math.round(drive.chase.gap)) : null,
            next: upcoming(drive, 3).map((p) => ({ type: p.type, name: p.name, m: Math.max(0, Math.round(p.d - drive.d)), waiting: p.waiting })),
            loading: here?.type === 'stop' && !here.served ? { name: here.name, waiting: here.waiting } : null,
            nearPlace: placeAt(drive)?.type || null,
            marks: drive.places.map((p) => ({ type: p.type, at: p.d / drive.length, done: p.served || (p.state && p.state !== 'ahead') })),
          },
        })
      }
      if (drive.over) {
        engine(null)
        sfx(drive.over === 'done' ? 'win' : drive.over === 'roadRage' ? 'hurt' : 'lose')
        useDrive.getState().end(drive.over, driveResult(drive))
      }
    }
    // bus + camera target
    if (bus.current) {
      bus.current.position.set(drive.x, Y, -drive.d)
      const lean = readDriveInput().steer * Math.min(1, drive.speed / 8)
      bus.current.rotation.y = Math.PI - lean * 0.08
      bus.current.rotation.z = lean * 0.02
    }
    playerState.driveView = { x: drive.x, z: -drive.d, speed: drive.speed }
    playerState.position.set(drive.x, 0, -drive.d) // for the crowd/shadows that follow the player
  })

  const slogan = params.slogan || 'NO TELLING'
  return (
    <group>
      <Road />
      <Suspense fallback={null}>
        <Segments />
      </Suspense>
      <Places drive={drive} />
      <Traffic drive={drive} />
      <Police drive={drive} />
      <Vehicle ref={bus} kind="danfo" slogan={slogan} rotation-y={Math.PI} />
      {/* a hint where the shoulder is */}
      <mesh position={[SHOULDER, 0.02, 0]} visible={false} />
    </group>
  )
}
