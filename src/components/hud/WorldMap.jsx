import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { buildMap, goalPoint, compass } from '../../game/world/mapData.js'
import { playerState, npcRegistry } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'
import Icon from '../Icon.jsx'

// The map of the world you're in: a small one in the corner while you walk
// around (tap it for the big one), and a full map with every named place.
// Tap a place on the full map to mark it; the corner map then points the way.
//
// Drawn as SVG in world metres (north up). The player's arrow and the goal
// move every frame by changing a few attributes directly, without React.

export const useMapStore = create((set) => ({
  waypoint: null, // { x, z, name } a place the player marked
  setWaypoint: (waypoint) => set({ waypoint }),
}))

const maps = new Map() // layout id -> built map (layouts are cached per world)
function useMap(layout) {
  return useMemo(() => {
    if (!maps.has(layout.id)) maps.set(layout.id, buildMap(layout))
    return maps.get(layout.id)
  }, [layout])
}

const rot = (a) => `rotate(${(-a * 180) / Math.PI})`

// Put each name next to its dot where it doesn't cover another name:
// above, below, right or left, whichever is free first (the first place wins).
function placeLabels(places, fontSize) {
  const boxes = []
  const hit = (a) => boxes.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0)
  return places.map((p) => {
    const w = p.name.length * fontSize * 0.56
    const h = fontSize * 1.05
    const options = [
      { dx: 0, dy: -fontSize * 0.8, anchor: 'middle' },
      { dx: 0, dy: fontSize * 1.55, anchor: 'middle' },
      { dx: fontSize * 0.8, dy: fontSize * 0.35, anchor: 'start' },
      { dx: -fontSize * 0.8, dy: fontSize * 0.35, anchor: 'end' },
      { dx: 0, dy: -fontSize * 2, anchor: 'middle' },
      { dx: 0, dy: fontSize * 2.75, anchor: 'middle' },
    ]
    const boxOf = (o) => {
      const x0 = o.anchor === 'middle' ? p.x + o.dx - w / 2 : o.anchor === 'start' ? p.x + o.dx : p.x + o.dx - w
      return { x0, x1: x0 + w, y0: p.z + o.dy - h * 0.85, y1: p.z + o.dy + h * 0.15 }
    }
    const pick = options.find((o) => !hit(boxOf(o))) || options[0]
    boxes.push(boxOf(pick))
    return pick
  })
}

function Ground({ map, labels = false, fontSize = 2.4, onPlace, waypointName }) {
  const b = map.bounds
  const spots = useMemo(() => (labels ? placeLabels(map.places, fontSize) : null), [labels, map, fontSize])
  return (
    <>
      <rect x={b.minX - 40} y={b.minZ - 40} width={b.maxX - b.minX + 80} height={b.maxZ - b.minZ + 80} className="map-ground" />
      {map.pavements.map((p, i) => (
        <rect key={`p${i}`} x={p.x} y={p.z} width={p.w} height={p.d} className="map-pavement" />
      ))}
      {map.roads.map((r, i) => (
        <rect key={`r${i}`} x={-r.w / 2 - 0.05} y={-r.d / 2 - 0.05} width={r.w + 0.1} height={r.d + 0.1} transform={`translate(${r.x} ${r.z}) ${rot(r.angle)}`} className="map-road" />
      ))}
      {map.blocks.map((r, i) => (
        <rect key={`b${i}`} x={-r.w / 2} y={-r.d / 2} width={r.w} height={r.d} transform={`translate(${r.x} ${r.z}) ${rot(r.angle)}`} className="map-block" />
      ))}
      {map.places.map((p, i) => (
        <g key={p.id} transform={`translate(${p.x} ${p.z})`} className={`map-place ${p.activity ? 'has-activity' : ''} ${waypointName === p.name ? 'is-marked' : ''}`} onClick={onPlace ? () => onPlace(p) : undefined}>
          <circle r={labels ? fontSize * 0.45 : 1.3} />
          {spots && (
            <text x={spots[i].dx} y={spots[i].dy} fontSize={fontSize} textAnchor={spots[i].anchor}>
              {p.name}
            </text>
          )}
        </g>
      ))}
    </>
  )
}

// the moving bits: the player's arrow, the goal and the marked place
function useLiveMarkers(refs, { goal, layout, radius }) {
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = playerState.position
      if (refs.svg.current && radius) refs.svg.current.setAttribute('viewBox', `${p.x - radius} ${p.z - radius} ${radius * 2} ${radius * 2}`)
      refs.me.current?.setAttribute('transform', `translate(${p.x} ${p.z}) ${rot(playerState.facing)}`)
      const targets = [
        [refs.goal, goalPoint(goal, layout, npcRegistry)],
        [refs.mark, useMapStore.getState().waypoint],
      ]
      for (const [ref, t] of targets) {
        const el = ref.current
        if (!el) continue
        if (!t) {
          el.setAttribute('visibility', 'hidden')
          continue
        }
        el.setAttribute('visibility', 'visible')
        let x = t.x
        let z = t.z
        // on the small map, something out of view sits on the edge, pointing at it
        const dx = x - p.x
        const dz = z - p.z
        const d = Math.hypot(dx, dz)
        const edge = radius ? radius * 0.84 : Infinity
        const off = d > edge
        if (off) {
          x = p.x + (dx / d) * edge
          z = p.z + (dz / d) * edge
        }
        el.setAttribute('transform', `translate(${x} ${z})`)
        el.classList.toggle('is-off', off)
      }
      if (refs.text.current) {
        const t = goalPoint(goal, layout, npcRegistry) || useMapStore.getState().waypoint
        if (!t) refs.text.current.textContent = ''
        else {
          const d = Math.round(Math.hypot(t.x - p.x, t.z - p.z))
          const who = t.who ? characters[t.who]?.name : t.label || t.name
          refs.text.current.textContent = d < 4 ? `${who || 'Goal'}: here` : `${who ? `${who} · ` : ''}${d} m ${compass(p.x, p.z, t.x, t.z)}`
        }
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [goal, layout, radius, refs])
}

function Markers({ refs, size }) {
  return (
    <>
      <g ref={refs.mark} className="map-mark" visibility="hidden">
        <circle r={size * 0.9} />
      </g>
      <g ref={refs.goal} className="map-goal" visibility="hidden">
        <circle r={size * 1.1} className="map-goal-ring" />
        <circle r={size * 0.55} />
      </g>
      <g ref={refs.me} className="map-me">
        <path d={`M0 ${size * 1.5} L${size} ${-size} L0 ${-size * 0.4} L${-size} ${-size} Z`} />
      </g>
    </>
  )
}

const useRefs = () => {
  const svg = useRef()
  const me = useRef()
  const goal = useRef()
  const mark = useRef()
  const text = useRef()
  return useMemo(() => ({ svg, me, goal, mark, text }), [])
}

/** The small map in the corner. Tap to open the big one. */
export function MiniMap({ layout, goal, onOpen }) {
  const map = useMap(layout)
  const refs = useRefs()
  useLiveMarkers(refs, { goal, layout, radius: 32 })
  return (
    <button className="minimap" onClick={onOpen} aria-label="Open the map" title="Map">
      <svg ref={refs.svg} viewBox="-32 -32 64 64" preserveAspectRatio="xMidYMid slice">
        <Ground map={map} />
        <Markers refs={refs} size={2.2} />
      </svg>
      <span className="minimap-n">N</span>
      <span ref={refs.text} className="minimap-goal" />
    </button>
  )
}

/** The full map: every named place; tap one to mark it. */
export function MapScreen({ layout, goal, onClose }) {
  const map = useMap(layout)
  const refs = useRefs()
  const waypoint = useMapStore((s) => s.waypoint)
  const setWaypoint = useMapStore((s) => s.setWaypoint)
  useLiveMarkers(refs, { goal, layout, radius: 0 })
  const b = map.bounds
  const pad = 4
  const width = b.maxX - b.minX + pad * 2
  const height = b.maxZ - b.minZ + pad * 2
  const font = Math.max(2, Math.min(3.2, width / 40))
  const mark = (p) => setWaypoint(waypoint?.name === p.name ? null : { x: p.x, z: p.z, name: p.name })
  useEffect(() => {
    const onKey = (e) => (e.key === 'Escape' || e.key === 'm' || e.key === 'M') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="map-screen" role="dialog" aria-label={`Map of ${map.name}`}>
      <div className="map-head">
        <Icon name="map" />
        <strong>{map.name}</strong>
        <span ref={refs.text} className="map-goal-text" />
        <button className="icon-btn" onClick={onClose} aria-label="Close the map">
          ✕
        </button>
      </div>
      <div className="map-body">
        <svg viewBox={`${b.minX - pad} ${b.minZ - pad} ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          <Ground map={map} labels fontSize={font} onPlace={mark} waypointName={waypoint?.name} />
          <Markers refs={refs} size={font * 0.55} />
        </svg>
        <ul className="map-list">
          {map.places.map((p) => (
            <li key={p.id}>
              <button className={`chip ${waypoint?.name === p.name ? 'on' : ''}`} onClick={() => mark(p)}>
                <Icon name="pin" size={14} /> {p.name}
                {p.activity ? <small> · {p.activity}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="map-hint">Tap a place to mark it; the small map points the way. Red with a yellow ring: where the story wants you. Orange dots: things you can start there.</p>
    </div>
  )
}
