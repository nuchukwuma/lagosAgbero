import { Suspense, forwardRef, useRef } from 'react'
import { Model } from '../world/Model.jsx'
import Sign from '../world/Sign.jsx'
import Keke from './Keke.jsx'
import Okada from './Okada.jsx'
import Character from '../characters/Character.jsx'
import vehicles from '../data/vehicles.json'
import { useBlobShadow } from '../world/Shadows.jsx'

// Draws one vehicle of any kind ("danfo", "keke", "okada", "taxi"...).
// Faces +Z. Danfos carry a painted slogan on the back; keke and okada get a
// rider (they are open, so an empty seat would look like a ghost ride).

const Vehicle = forwardRef(function Vehicle({ kind, slogan, color, riderLook, ...groupProps }, ref) {
  const k = vehicles.kinds[kind] || vehicles.kinds.danfo
  const body = useRef()
  useBlobShadow(body, { size: [k.width || 1.9, k.length || 4.4] })
  return (
    <group ref={ref} {...groupProps}>
      <group ref={body} />
      {k.procedural === 'keke' && <Keke color={color} />}
      {k.procedural === 'okada' && <Okada color={color} />}
      {k.model && <Model name={k.model} />}
      {slogan && <Sign at={[0, -k.length / 2 - 0.03, 180]} y={1.45} size={[1.9, 0.32]} lines={[slogan]} bg="#f6ecd2" fg="#1a1408" />}
      {k.rider && riderLook && (
        <Suspense fallback={null}>
          <Character look={riderLook} animation={k.rider} position={kind === 'okada' ? [0, 0.3, -0.25] : [0, 0.25, 0.2]} />
        </Suspense>
      )}
    </group>
  )
})

export default Vehicle
