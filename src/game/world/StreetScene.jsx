import { useMemo } from 'react'
import { ModelInstances } from './Model.jsx'
import { preloadModels } from './models.js'
import { Ground, Pavements, Flyover, Wires, BusShelter } from './StreetBits.jsx'
import MarketStall from './MarketStall.jsx'
import Sign from './Sign.jsx'

// All static scenery of a world layout. Repeated models are instanced.

export default function StreetScene({ layout }) {
  const raw = layout.raw
  useMemo(() => preloadModels(layout.groups.map((g) => g.model)), [layout])

  const poleGroups = useMemo(
    () => layout.groups.filter((g) => g.wires).map((g) => g.items.map((it) => [it.position[0], it.position[2]])),
    [layout],
  )

  return (
    <group>
      <Ground bounds={layout.bounds} />
      <Pavements list={raw.pavements || []} />
      {layout.groups.map((g, i) => (
        <ModelInstances key={`${g.model}-${i}`} name={g.model} items={g.items} />
      ))}
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
