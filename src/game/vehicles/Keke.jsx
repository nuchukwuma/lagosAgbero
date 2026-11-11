import * as THREE from 'three'
import { Model } from '../world/Model.jsx'

// Keke (tricycle), built from simple shapes plus Kenney wheels.
// Faces +Z like the Kenney cars. About 2.6 m long, 1.3 m wide, 1.8 m tall.
// The kart model has a bulky racing chassis, so shapes read better here.

const yellow = new THREE.MeshLambertMaterial({ color: '#e8c21c' })
const green = new THREE.MeshLambertMaterial({ color: '#2f8f5b' })
const dark = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const canvas = new THREE.MeshLambertMaterial({ color: '#1b1b1b' })
const glass = new THREE.MeshLambertMaterial({ color: '#9fc6d9', transparent: true, opacity: 0.55 })
const seat = new THREE.MeshLambertMaterial({ color: '#6d2b1f' })

function Box({ size, position, rotation, material }) {
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <boxGeometry args={size} />
    </mesh>
  )
}

export default function Keke({ color }) {
  const body = color ? new THREE.MeshLambertMaterial({ color }) : yellow
  return (
    <group>
      {/* floor + rear cabin */}
      <Box size={[1.2, 0.12, 2.2]} position={[0, 0.38, -0.05]} material={dark} />
      <Box size={[1.3, 0.7, 1.05]} position={[0, 0.78, -0.55]} material={body} />
      <Box size={[1.32, 0.12, 1.07]} position={[0, 0.62, -0.55]} material={green} />
      <Box size={[1.1, 0.12, 0.45]} position={[0, 1.05, -0.45]} material={seat} />
      {/* nose and dashboard */}
      <Box size={[0.75, 0.85, 0.6]} position={[0, 0.7, 0.95]} rotation={[-0.25, 0, 0]} material={body} />
      <Box size={[1.1, 0.7, 0.04]} position={[0, 1.35, 0.68]} rotation={[-0.2, 0, 0]} material={glass} />
      {/* canopy and posts */}
      <Box size={[1.36, 0.07, 2.15]} position={[0, 1.78, -0.12]} material={canvas} />
      {[
        [0.62, 0.72],
        [-0.62, 0.72],
        [0.62, -1.05],
        [-0.62, -1.05],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.05, 1.0, 0.05]} position={[x, 1.28, z]} material={dark} />
      ))}
      {/* wheels: one in front, two at the back */}
      <Model name="kekeWheel" position={[0, 0.27, 1.05]} scale={0.55} />
      <Model name="kekeWheel" position={[0.66, 0.27, -0.75]} scale={0.55} />
      <Model name="kekeWheel" position={[-0.66, 0.27, -0.75]} scale={0.55} rotation-y={Math.PI} />
    </group>
  )
}
