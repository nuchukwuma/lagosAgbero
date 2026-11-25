// What you see around a building you've walked into, so it doesn't float in
// nothing: its yard, the compound wall and gate, the neighbours, trees. Made
// from the interior's "setting" and the line of its outer walls; everything
// here is outside the walls, and the camera only looks over it.
//   estate  a walled compound on a quiet rich street: tiles, a gate, a car, palms, big houses next door
//   campus  lawns and paths between other hostel blocks, trees
//   bush    red earth, palms and bush closing in, rocks
import { PROPS, transformPrims, mulberry32 } from '../cityFill.js'

/** The box the outer walls make: { minX, maxX, minZ, maxZ }. */
export function houseBox(interior) {
  const xs = []
  const zs = []
  for (const [x1, z1, x2, z2] of interior.walls || []) xs.push(x1, x2), zs.push(z1, z2)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

export const GROUND = { estate: '#6f6c64', campus: '#5d8a3a', bush: '#8a4f2c' }
export const YARD = { estate: '#9a958a', campus: '#a89f8c', bush: '#7a4a2c' }

/** Wall segments (3.8 m each) along a line, leaving out a gap: [{ at: [x, z, rot] }]. */
function wallLine(x1, z1, x2, z2, gap = null) {
  const len = Math.hypot(x2 - x1, z2 - z1)
  const n = Math.max(1, Math.round(len / 3.8))
  const rot = (Math.atan2(-(z2 - z1), x2 - x1) * 180) / Math.PI
  const out = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const x = x1 + (x2 - x1) * t
    const z = z1 + (z2 - z1) * t
    if (gap && Math.abs(x - gap[0]) < gap[2] && Math.abs(z - gap[1]) < gap[2]) continue
    out.push([+x.toFixed(2), +z.toFixed(2), rot])
  }
  return out
}

/** { groups: [{ model, at, solid }], prims: [...], yard: { minX, maxX, minZ, maxZ }, ground } */
export function surroundings(interior) {
  const setting = interior.setting
  if (!setting) return { groups: [], prims: [], yard: null, ground: '#3d3a33' }
  const b = houseBox(interior)
  const rng = mulberry32(Math.round((b.maxX - b.minX) * 13 + (b.maxZ - b.minZ) * 7))
  const groups = []
  const prims = []
  const palm = (x, z) => prims.push(...transformPrims(PROPS.palmTree(rng).prims, x, z, rng() * 6.28))
  const bush = (x, z) => prims.push(...transformPrims(PROPS.bush(rng).prims, x, z, 0))
  const cx = (b.minX + b.maxX) / 2
  const yard = { minX: b.minX - 5, maxX: b.maxX + 5, minZ: b.minZ - 4, maxZ: b.maxZ + 7 }

  if (setting === 'estate') {
    // the compound wall, with the gate in front of the door
    const gate = [cx, yard.maxZ, 3]
    const at = [
      ...wallLine(yard.minX, yard.maxZ, yard.maxX, yard.maxZ, gate),
      ...wallLine(yard.minX, yard.minZ, yard.maxX, yard.minZ),
      ...wallLine(yard.minX, yard.minZ, yard.minX, yard.maxZ),
      ...wallLine(yard.maxX, yard.minZ, yard.maxX, yard.maxZ),
    ]
    groups.push({ model: 'compoundFence', at })
    groups.push({ model: 'bigManSportsCar', at: [[b.maxX - 2.5, b.maxZ + 3.6, 90]] })
    groups.push({ model: 'streetLampCurved', at: [[cx - 3.6, yard.maxZ + 1.6, 0], [cx + 3.6, yard.maxZ + 1.6, 0]] })
    groups.push({ model: 'planter', at: [[b.minX + 2, b.maxZ + 2.2, 0]] })
    // the neighbours
    groups.push({ model: 'richManHouse', at: [[yard.minX - 10, cx - 2, 90]] })
    groups.push({ model: 'bigManDuplex', at: [[yard.maxX + 8, (b.minZ + b.maxZ) / 2, -90]] })
    groups.push({ model: 'richManHouseC', at: [[cx, yard.minZ - 9, 0]] })
    groups.push({ model: 'chairmanHouse', at: [[cx + 4, yard.maxZ + 16, 180]] })
    for (const [x, z] of [[yard.minX + 1.5, yard.minZ + 1.5], [yard.maxX - 1.5, yard.minZ + 1.5], [yard.minX + 1.5, yard.maxZ - 1.5], [yard.maxX - 1.5, yard.maxZ - 1.5]]) palm(x, z)
    for (let i = 0; i < 6; i++) bush(yard.minX + 1 + rng() * (yard.maxX - yard.minX - 2), yard.maxZ - 0.8)
  } else if (setting === 'campus') {
    groups.push({ model: 'tenementA', at: [[b.minX - 11, cx, 90], [b.maxX + 11, cx, -90]] })
    groups.push({ model: 'tenementB', at: [[cx, b.minZ - 10, 0]] })
    groups.push({ model: 'path', at: [[cx, b.maxZ + 1.8, 0], [cx, b.maxZ + 5, 0], [cx, b.maxZ + 8.2, 0]] })
    groups.push({ model: 'treeLarge', at: [[b.minX - 4, b.maxZ + 3, 0], [b.maxX + 4, b.maxZ + 4, 0], [b.minX - 4, b.minZ - 3, 0]] })
    groups.push({ model: 'treeSmall', at: [[b.maxX + 4, b.minZ - 2, 0], [cx - 7, b.maxZ + 12, 0]] })
    // bushes along the front, but none on the path (or in front of the camera at the door)
    for (let i = 0; i < 6; i++) {
      const x = b.minX - 1 + rng() * (b.maxX - b.minX + 2)
      if (Math.abs(x - cx) > 3.5) bush(x, b.maxZ + 1 + rng() * 1.2)
    }
  } else if (setting === 'bush') {
    // the bush closing in round the compound
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng() * 0.2
      const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 3.5 + rng() * 6
      const x = cx + Math.sin(a) * r * 1.1
      const z = (b.minZ + b.maxZ) / 2 + Math.cos(a) * r
      if (z > b.maxZ && Math.abs(x - cx) < 3) continue // the path in stays clear
      ;(i % 3 ? bush : palm)(x, z)
    }
    for (let i = 0; i < 8; i++) {
      const x = b.minX - 2 + rng() * (b.maxX - b.minX + 4)
      const z = b.maxZ + 1.5 + rng() * 4
      if (Math.abs(x - cx) < 2) continue
      prims.push(...transformPrims(PROPS.rock(rng).prims, x, z, 0))
    }
  }
  return { groups, prims, yard: setting === 'estate' ? yard : null, ground: GROUND[setting], yardColor: YARD[setting] }
}
