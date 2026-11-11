import * as THREE from 'three'
import { Model } from '../world/Model.jsx'

// Okada (motorbike taxi), built from simple shapes plus two Kenney wheels.
// Faces +Z. About 1.9 m long and 1.1 m tall.

const frame = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const chrome = new THREE.MeshLambertMaterial({ color: '#b8b8b8' })
const seatMat = new THREE.MeshLambertMaterial({ color: '#141414' })
const lamp = new THREE.MeshBasicMaterial({ color: '#fff3c4' })
const tankCache = new Map()
const tankMaterial = (c) => {
  if (!tankCache.has(c)) tankCache.set(c, new THREE.MeshLambertMaterial({ color: c }))
  return tankCache.get(c)
}

function Box({ size, position, rotation, material }) {
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <boxGeometry args={size} />
    </mesh>
  )
}

export default function Okada({ color = '#c0392b' }) {
  return (
    <group>
      <Model name="okadaWheel" position={[0, 0.3, 0.68]} scale={0.6} />
      <Model name="okadaWheel" position={[0, 0.3, -0.62]} scale={0.6} />
      {/* frame, engine, exhaust */}
      <Box size={[0.1, 0.1, 1.15]} position={[0, 0.58, 0.02]} rotation={[0.12, 0, 0]} material={frame} />
      <Box size={[0.3, 0.3, 0.4]} position={[0, 0.42, 0.02]} material={frame} />
      <Box size={[0.08, 0.08, 0.7]} position={[0.18, 0.32, -0.3]} material={chrome} />
      {/* tank, seat, rear rack */}
      <Box size={[0.32, 0.2, 0.45]} position={[0, 0.82, 0.22]} material={tankMaterial(color)} />
      <Box size={[0.3, 0.1, 0.7]} position={[0, 0.86, -0.3]} material={seatMat} />
      <Box size={[0.36, 0.04, 0.3]} position={[0, 0.82, -0.72]} material={chrome} />
      {/* fork, handlebar, headlight */}
      <Box size={[0.05, 0.7, 0.05]} position={[0.1, 0.65, 0.62]} rotation={[-0.35, 0, 0]} material={chrome} />
      <Box size={[0.05, 0.7, 0.05]} position={[-0.1, 0.65, 0.62]} rotation={[-0.35, 0, 0]} material={chrome} />
      <Box size={[0.75, 0.05, 0.05]} position={[0, 1.05, 0.5]} material={chrome} />
      <Box size={[0.16, 0.14, 0.08]} position={[0, 0.95, 0.66]} material={lamp} />
    </group>
  )
}
