import Sign from './Sign.jsx'
import { GROUND_Y } from './layout.js'

// A market stall's painted name board. The stall itself (container, awning,
// table, goods) is part of the merged street scenery: see stalls.js.

export default function MarketStall({ stall }) {
  const [x, z, rot = 0] = stall.at
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={(rot * Math.PI) / 180}>
      {stall.sign && (
        <Sign at={stall.small ? [0.2, 0.5, 0] : [0, 1.85, 0]} y={stall.small ? 1.45 : 2.55} size={stall.small ? [1.6, 0.35] : [4.2, 0.7]} lines={[stall.sign]} bg="#f6ecd2" fg="#1a1408" />
      )}
    </group>
  )
}
