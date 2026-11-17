import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { buildMap, goalPoint, compass, mapPicture } from '../../game/world/mapData.js'
import { playerState, npcRegistry } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'
import { traffic, LANES } from '../../game/systems/traffic.js'
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
      // what the current street mode is about: fee vehicles still waiting to
      // pay (green), the vehicle you're chasing (red)
      const extra = refs.extra.current
      let chase = null
      if (extra) {
        let i = 0
        for (const v of traffic.vehicles) {
          const wanted = v.tag.chaseTarget ? 'is-chase' : v.tag.feeRun && !v.tag.done && v.state === 'stopped' ? 'is-fee' : null
          if (!wanted || i >= extra.children.length) continue
          const el = extra.children[i++]
          el.setAttribute('transform', `translate(${v.x} ${LANES[v.lane].z})`)
          el.setAttribute('class', wanted)
          el.setAttribute('visibility', 'visible')
          if (wanted === 'is-chase') chase = { x: v.x, z: LANES[v.lane].z, label: 'Runaway driver' }
        }
        for (; i < extra.children.length; i++) extra.children[i].setAttribute('visibility', 'hidden')
      }
      if (refs.text.current) {
        const t = goalPoint(goal, layout, npcRegistry) || chase || useMapStore.getState().waypoint
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
      <g ref={refs.extra}>
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} r={size * 0.8} visibility="hidden" />
        ))}
      </g>
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
  const extra = useRef()
  return useMemo(() => ({ svg, me, goal, mark, text, extra }), [])
}

// ---- the small map in the corner ----
// The map is one picture (mapPicture) slid under a fixed arrow with a CSS
// transform: the phone's compositor moves it, nothing is redrawn. The few
// markers (goal, marked place, fee vehicles, the chase) are small dots
// updated ten times a second.
const MINI_RADIUS = 32 // metres from the centre to the edge
const pictures = new Map() // layout id -> { url, x0, z0, w, h }
function usePicture(map) {
  return useMemo(() => {
    if (!pictures.has(map.id)) {
      const pic = mapPicture(map)
      pictures.set(map.id, { ...pic, url: URL.createObjectURL(new Blob([pic.svg], { type: 'image/svg+xml' })) })
    }
    return pictures.get(map.id)
  }, [map])
}

/** The small map in the corner. Tap to open the big one (outside street modes). */
export function MiniMap({ layout, goal, onOpen }) {
  const map = useMap(layout)
  const pic = usePicture(map)
  const box = useRef()
  const img = useRef()
  const arrow = useRef()
  const dots = useRef()
  const text = useRef()
  useEffect(() => {
    let raf = 0
    let last = 0
    let size = 0
    let seen = ''
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const el = box.current
      if (!el || !img.current) return
      // size only when the box changes (reading and setting it every frame
      // makes the browser lay the page out again)
      if (!size || now - last >= 100) {
        const w = el.clientWidth
        if (w !== size) {
          size = w
          img.current.style.width = `${(pic.w * (size / (MINI_RADIUS * 2))).toFixed(1)}px`
        }
      }
      const s = size / (MINI_RADIUS * 2) // CSS pixels per metre
      const p = playerState.position
      // slide the map and turn the arrow only when you've moved
      const key = `${p.x.toFixed(2)},${p.z.toFixed(2)},${playerState.facing.toFixed(2)}`
      if (key !== seen) {
        seen = key
        img.current.style.transform = `translate(${(size / 2 - (p.x - pic.x0) * s).toFixed(1)}px, ${(size / 2 - (p.z - pic.z0) * s).toFixed(1)}px)`
        arrow.current.style.transform = `translate(-50%, -50%) rotate(${((-playerState.facing * 180) / Math.PI).toFixed(1)}deg)`
      }
      if (now - last < 100) return
      last = now
      const targets = []
      const g = goalPoint(goal, layout, npcRegistry)
      if (g) targets.push(['is-goal', g])
      const w = useMapStore.getState().waypoint
      if (w) targets.push(['is-mark', w])
      let chase = null
      for (const v of traffic.vehicles) {
        const kind = v.tag.chaseTarget ? 'is-chase' : v.tag.feeRun && !v.tag.done && v.state === 'stopped' ? 'is-fee' : null
        if (!kind) continue
        const t = { x: v.x, z: LANES[v.lane].z }
        if (kind === 'is-chase') chase = { ...t, label: 'Runaway driver' }
        targets.push([kind, t])
      }
      const kids = dots.current.children
      for (let i = 0; i < kids.length; i++) {
        const d = kids[i]
        const t = targets[i]
        if (!t) {
          d.style.display = 'none'
          continue
        }
        let dx = (t[1].x - p.x) * s
        let dz = (t[1].z - p.z) * s
        const len = Math.hypot(dx, dz)
        const edge = size / 2 - 7
        const off = len > edge
        if (off) {
          dx *= edge / len
          dz *= edge / len
        }
        d.className = `minimap-dot ${t[0]} ${off ? 'is-off' : ''}`
        d.style.display = 'block'
        d.style.transform = `translate(${(size / 2 + dx).toFixed(1)}px, ${(size / 2 + dz).toFixed(1)}px) translate(-50%, -50%)`
      }
      const t = g || chase || w
      if (text.current) {
        if (!t) text.current.textContent = ''
        else {
          const d = Math.round(Math.hypot(t.x - p.x, t.z - p.z))
          const who = t.who ? characters[t.who]?.name : t.label || t.name
          text.current.textContent = d < 4 ? `${who || 'Goal'}: here` : `${who ? `${who} · ` : ''}${d} m ${compass(p.x, p.z, t.x, t.z)}`
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [goal, layout, pic])
  return (
    <button className={`minimap ${onOpen ? '' : 'is-passive'}`} onClick={onOpen || undefined} aria-label={onOpen ? 'Open the map' : 'Map'} title="Map">
      <span ref={box} className="minimap-view">
        <img ref={img} src={pic.url} alt="" draggable={false} />
        <span ref={dots} className="minimap-dots">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="minimap-dot" />
          ))}
        </span>
        <span ref={arrow} className="minimap-me" />
      </span>
      <span className="minimap-n">N</span>
      <span ref={text} className="minimap-goal" />
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
