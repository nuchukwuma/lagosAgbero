// Developer tool (not part of the game): photographs the game's own 3D vehicles
// from an isometric camera at eight headings, for the 2D Go-Slow junction.
// Run by scripts/bake-goslow-sprites.cjs through the dev server.
import { Suspense } from 'react'
import * as THREE from 'three'
import { createRoot, extend } from '@react-three/fiber'
import Vehicle from '../game/vehicles/Vehicle.jsx'
import characters from '../game/data/characters.json'

extend(THREE) // the standalone root needs the three.js classes registered

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * kinds: [{ kind, color?, slogan?, rider? }]; returns { cell, ppm, rows: { name: [dataURL x headings] } }.
 * Heading h (0..7) is the direction of travel on screen, clockwise from "up-right" (north on the junction).
 */
export async function bake({ kinds, headings = 8, cell = 144, ppm = 15 }) {
  const canvas = document.createElement('canvas')
  canvas.width = cell
  canvas.height = cell
  document.body.appendChild(canvas)
  const root = createRoot(canvas)
  const half = cell / 2 / ppm
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200)
  // isometric: looking down 35 degrees, from the south-west corner of the junction
  const el = (35 * Math.PI) / 180
  const az = Math.PI / 4
  camera.position.set(Math.sin(az) * Math.cos(el) * 40, Math.sin(el) * 40, Math.cos(az) * Math.cos(el) * 40)
  camera.lookAt(0, 0.9, 0)
  camera.manual = true // keep our frustum (R3F would size it to the canvas in pixels)
  root.configure({ gl: { preserveDrawingBuffer: true, alpha: true, antialias: true }, camera, size: { width: cell, height: cell, top: 0, left: 0 }, dpr: 1, frameloop: 'always', flat: true })
  const out = {}
  for (const k of kinds) {
    out[k.name] = []
    for (let h = 0; h < headings; h++) {
      // screen "up-right" is world -Z after the camera's 45 degree turn; vehicles face +Z
      const rot = Math.PI - (h * 2 * Math.PI) / headings
      root.render(
        <>
          <ambientLight intensity={1.1} />
          <directionalLight position={[6, 10, 3]} intensity={1.6} />
          <Suspense fallback={null}>
            <Vehicle kind={k.kind} color={k.color} slogan={k.slogan} riderLook={k.rider ? characters[k.rider]?.look : null} rotation={[0, rot, 0]} />
          </Suspense>
        </>,
      )
      await wait(h === 0 ? 2500 : 250) // the first heading waits for the model to load
      out[k.name].push(canvas.toDataURL('image/png'))
    }
  }
  root.unmount()
  canvas.remove()
  return { cell, ppm, headings, rows: out }
}
