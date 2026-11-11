import { useMemo } from 'react'
import * as THREE from 'three'

// Painted signboards: text drawn once on a <canvas> and used as a texture.
// Used for billboards, shop signs, the bus stop name, party posters.

const textureCache = new Map()

function signTexture(lines, bg, fg, aspect) {
  const key = JSON.stringify([lines, bg, fg, aspect.toFixed(2)])
  if (textureCache.has(key)) return textureCache.get(key)
  const h = 128
  const w = Math.min(1024, Math.round(h * aspect))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, w - 6, h - 6)
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const n = lines.length
  lines.forEach((line, i) => {
    const size = i === 0 ? Math.min(h / (n + 0.4), (w / Math.max(line.length, 4)) * 1.7) : Math.min(h / (n + 1.4), (w / Math.max(line.length, 4)) * 1.6)
    ctx.font = `${i === 0 ? 900 : 600} ${size}px system-ui, sans-serif`
    ctx.fillText(line, w / 2, (h * (i + 0.5)) / n)
  })
  // a little sun-fade so it looks Lagos, not brand-new
  ctx.fillStyle = 'rgba(255,240,210,0.08)'
  ctx.fillRect(0, 0, w, h)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 2
  textureCache.set(key, t)
  return t
}

const postMaterial = new THREE.MeshLambertMaterial({ color: '#4a4a4a' })

export default function Sign({ at, y = 3, size = [4, 1], lines = [''], bg = '#f2c300', fg = '#1a1408', post = false }) {
  const [w, h] = size
  const map = useMemo(() => signTexture(lines, bg, fg, w / h), [lines, bg, fg, w, h])
  const [x, z, rot = 0] = at
  return (
    <group position={[x, 0, z]} rotation-y={(rot * Math.PI) / 180}>
      <mesh position={[0, y, 0]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial map={map} side={THREE.DoubleSide} />
      </mesh>
      {post &&
        [-w * 0.35, w * 0.35].map((px) => (
          <mesh key={px} position={[px, (y - h / 2) / 2, -0.05]} material={postMaterial}>
            <boxGeometry args={[0.18, y - h / 2, 0.18]} />
          </mesh>
        ))}
    </group>
  )
}
