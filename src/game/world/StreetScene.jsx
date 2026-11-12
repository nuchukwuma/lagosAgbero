import { useMemo } from 'react'
import { Flyover, Wires, BusShelter } from './StreetBits.jsx'
import { StaticWorld, Props, Skyline, NightGlows, Ground, Pavements, GroundDetail } from './Scenery.jsx'
import { FakeShadows } from './Shadows.jsx'
import MarketStall from './MarketStall.jsx'
import Sign from './Sign.jsx'

// All static scenery of a world layout. Models are merged into a few big
// meshes (staticBatch.js); generated clutter and the skyline come from
// cityFill.js through layout.fill.

export default function StreetScene({ layout }) {
  const raw = layout.raw
  const poleGroups = useMemo(
    () => layout.groups.filter((g) => g.wires).map((g) => g.items.map((it) => [it.position[0], it.position[2]])),
    [layout],
  )
  const glows = useMemo(
    () => [
      ...layout.fill.lights,
      ...(raw.stalls || []).map((s) => ({ x: s.at[0], y: 1.9, z: s.at[1] + (s.small ? 0 : 0.8), size: s.small ? 2.4 : 4 })),
    ],
    [layout, raw],
  )

  return (
    <group>
      <Ground bounds={layout.bounds} />
      <Pavements list={raw.pavements || []} />
      <GroundDetail layout={layout} />
      <StaticWorld groups={layout.groups} />
      <Props prims={layout.fill.prims} />
      <Skyline blocks={layout.fill.blocks} />
      <FakeShadows boxes={layout.shadows} />
      <NightGlows lights={glows} />
      {raw.flyover && <Flyover f={raw.flyover} />}
      <Wires poleGroups={poleGroups} />
      {(raw.stalls || []).map((s, i) => (
        <MarketStall key={s.id} stall={s} index={i} />
      ))}
      {(raw.signs || []).map((s, i) => (
        <Sign key={i} {...s} />
      ))}
      {(raw.shelters || []).map((s, i) => (
        <BusShelter key={i} at={s.at} />
      ))}
    </group>
  )
}
