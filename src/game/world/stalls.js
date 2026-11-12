// Market stalls as data: a shipping container (a real model, batched with
// the rest of the street) plus an awning, poles, a table and goods built
// from simple shapes (merged with the other street props). A whole market
// row costs a handful of draw calls instead of a hundred.
//
// Stall front faces +Z (towards the road) at rotation 0.

const GOODS = {
  provisions: ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#e67e22'],
  fabric: ['#8e44ad', '#16a085', '#f39c12', '#c0392b', '#2980b9'],
  phones: ['#2c3e50', '#7f8c8d', '#1abc9c', '#34495e'],
  food: ['#d35400', '#f39c12', '#c0392b', '#27ae60'],
  radio: ['#2c3e50', '#95a5a6'],
  tea: ['#bdc3c7', '#16a085'],
}
const WOOD = '#8b5a2b'
const POLE = '#5d4037'
const CONTAINERS = ['shippingContainerA', 'shippingContainerB', 'shippingContainerC']

function goods(type, width, depth, y, z0) {
  const colors = GOODS[type] || GOODS.provisions
  const out = []
  const n = Math.max(3, Math.round(width * 2.2))
  for (let i = 0; i < n; i++) {
    const s = 0.18 + ((i * 37) % 10) / 50
    out.push({ s: 'box', p: [-width / 2 + 0.25 + (i * (width - 0.5)) / (n - 1), y + s / 2, z0 + (((i * 53) % 7) / 7 - 0.5) * depth * 0.6], d: [s * 1.2, s, s], c: colors[i % colors.length] })
  }
  return out
}

/** Local prims (stall at the origin, facing +Z) and an optional container. */
export function stallParts(stall, index) {
  if (stall.small) {
    const prims = [
      { s: 'box', p: [0, 0.42, 0], d: [1.8, 0.84, 0.9], c: WOOD },
      ...goods(stall.goods, 1.5, 0.7, 0.84, 0),
      { s: 'cyl', p: [-0.7, 1.3, -0.3], d: [0.04, 2.6], c: POLE },
      { s: 'cone', p: [-0.7, 2.55, -0.3], d: [1.5, 0.6], c: stall.color },
    ]
    if (stall.goods === 'radio') prims.push({ s: 'box', p: [0.3, 1.05, 0], d: [0.5, 0.3, 0.2], c: '#1a1a1a' })
    return { prims, container: null }
  }
  return {
    prims: [
      { s: 'box', p: [0, 2.75, 0.55], d: [6.8, 0.05, 2.6], c: stall.color, rx: 0.28 },
      { s: 'box', p: [-3.2, 1.25, 1.75], d: [0.1, 2.5, 0.1], c: POLE },
      { s: 'box', p: [3.2, 1.25, 1.75], d: [0.1, 2.5, 0.1], c: POLE },
      { s: 'box', p: [0, 0.45, 1.0], d: [5, 0.9, 1.0], c: WOOD },
      ...goods(stall.goods, 4.6, 0.9, 0.9, 1.0),
    ],
    container: { model: CONTAINERS[index % 3], position: [0, 0, -1.6], rotation: 90 },
  }
}

/** World-space prims and container placements for every stall in a layout. */
export function buildStalls(stalls = [], y = 0.02) {
  const prims = []
  const containers = new Map()
  stalls.forEach((stall, i) => {
    const [x, z, rot = 0] = stall.at
    const a = (rot * Math.PI) / 180
    const c = Math.cos(a)
    const s = Math.sin(a)
    const toWorld = (px, pz) => [x + px * c + pz * s, z - px * s + pz * c]
    const parts = stallParts(stall, i)
    for (const q of parts.prims) {
      const [wx, wz] = toWorld(q.p[0], q.p[2])
      prims.push({ ...q, p: [wx, q.p[1] + y, wz], ry: (q.ry || 0) + a })
    }
    if (parts.container) {
      const k = parts.container
      const [wx, wz] = toWorld(k.position[0], k.position[2])
      if (!containers.has(k.model)) containers.set(k.model, [])
      containers.get(k.model).push({ position: [wx, y, wz], rotation: rot + k.rotation, scale: 1 })
    }
  })
  return { prims, groups: [...containers.entries()].map(([model, items]) => ({ kind: 'building', model, items, solid: false, wires: null })) }
}
