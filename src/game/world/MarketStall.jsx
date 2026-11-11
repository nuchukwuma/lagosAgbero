import { useMemo } from 'react'
import * as THREE from 'three'
import { Model } from './Model.jsx'
import Sign from './Sign.jsx'
import { GROUND_Y } from './layout.js'

// Market stalls built from a shipping container + a cloth awning + a table of
// goods. Small stalls (Mama Put, tea, radio) are a table under an umbrella.
// The stall's front faces +Z (towards the road) at rotation 0.

const GOODS = {
  provisions: ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#e67e22'],
  fabric: ['#8e44ad', '#16a085', '#f39c12', '#c0392b', '#2980b9'],
  phones: ['#2c3e50', '#7f8c8d', '#1abc9c', '#34495e'],
  food: ['#d35400', '#f39c12', '#c0392b', '#27ae60'],
  radio: ['#2c3e50', '#95a5a6'],
  tea: ['#bdc3c7', '#16a085'],
}

const wood = new THREE.MeshLambertMaterial({ color: '#8b5a2b' })
const pole = new THREE.MeshLambertMaterial({ color: '#5d4037' })
const box = new THREE.BoxGeometry(1, 1, 1)

function Goods({ type, width, depth, y }) {
  const colors = GOODS[type] || GOODS.provisions
  const items = useMemo(() => {
    const out = []
    const n = Math.max(3, Math.round(width * 2.2))
    for (let i = 0; i < n; i++) {
      const s = 0.18 + ((i * 37) % 10) / 50
      out.push({ x: -width / 2 + 0.25 + (i * (width - 0.5)) / (n - 1), z: (((i * 53) % 7) / 7 - 0.5) * depth * 0.6, s, c: colors[i % colors.length] })
    }
    return out
  }, [type, width, depth, colors])
  return items.map((g, i) => (
    <mesh key={i} geometry={box} position={[g.x, y + g.s / 2, g.z]} scale={[g.s * 1.2, g.s, g.s]}>
      <meshLambertMaterial color={g.c} />
    </mesh>
  ))
}

function BigStall({ color, goods, seed }) {
  const container = ['shippingContainerA', 'shippingContainerB', 'shippingContainerC'][seed % 3]
  return (
    <group>
      {/* container behind, long side facing the road */}
      <Model name={container} position={[0, 0, -1.6]} rotation-y={Math.PI / 2} />
      {/* sagging cloth awning */}
      <mesh position={[0, 2.75, 0.55]} rotation-x={0.28}>
        <boxGeometry args={[6.8, 0.05, 2.6]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} material={pole} position={[x, 1.25, 1.75]}>
          <boxGeometry args={[0.1, 2.5, 0.1]} />
        </mesh>
      ))}
      {/* table */}
      <mesh material={wood} position={[0, 0.45, 1.0]}>
        <boxGeometry args={[5, 0.9, 1.0]} />
      </mesh>
      <group position={[0, 0, 1.0]}>
        <Goods type={goods} width={4.6} depth={0.9} y={0.9} />
      </group>
    </group>
  )
}

function SmallStall({ color, goods }) {
  return (
    <group>
      <mesh material={wood} position={[0, 0.42, 0]}>
        <boxGeometry args={[1.8, 0.84, 0.9]} />
      </mesh>
      <Goods type={goods} width={1.5} depth={0.7} y={0.84} />
      {goods === 'radio' && (
        <mesh position={[0.3, 1.05, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.2]} />
          <meshLambertMaterial color="#1a1a1a" />
        </mesh>
      )}
      {/* umbrella */}
      <mesh material={pole} position={[-0.7, 1.3, -0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 2.6, 6]} />
      </mesh>
      <mesh position={[-0.7, 2.55, -0.3]}>
        <coneGeometry args={[1.5, 0.6, 8, 1, true]} />
        <meshLambertMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export default function MarketStall({ stall, index }) {
  const [x, z, rot = 0] = stall.at
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={(rot * Math.PI) / 180}>
      {stall.small ? <SmallStall color={stall.color} goods={stall.goods} /> : <BigStall color={stall.color} goods={stall.goods} seed={index} />}
      {stall.sign && (
        <Sign at={stall.small ? [0.2, 0.5, 0] : [0, 1.85, 0]} y={stall.small ? 1.45 : 2.55} size={stall.small ? [1.6, 0.35] : [4.2, 0.7]} lines={[stall.sign]} bg="#f6ecd2" fg="#1a1408" />
      )}
    </group>
  )
}
