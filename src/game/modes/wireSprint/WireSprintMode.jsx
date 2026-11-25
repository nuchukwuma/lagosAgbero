import { useEffect, useRef, useState } from 'react'
import { useSprint, race, sprintInput } from './wireSprintStore.js'
import { sprintResult, AVENUES, EDGE, ROADBLOCKS } from './wireSprintLogic.js'
import { briefSprint } from './WireSprintScene.jsx'
import { formatNaira } from '../../narrative/stats.js'
import { openShareCard } from '../../../components/share/shareCard.js'

// Beat-the-Bet Wire Sprint: the overlay. Intro, the clock and the drops, a
// small radar (north up), the rivals' progress, the pedals, the result.

const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'brake' }
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** North-up radar: the avenues, the drops, the rivals, you. */
function Radar({ hud }) {
  const ref = useRef()
  useEffect(() => {
    const c = ref.current
    if (!c || !hud) return
    const g = c.getContext('2d')
    const S = c.width
    const k = S / (EDGE * 2 + 16)
    const X = (x) => S / 2 + x * k
    const Z = (z) => S / 2 + z * k
    g.clearRect(0, 0, S, S)
    g.fillStyle = 'rgba(12, 14, 18, 0.82)'
    g.fillRect(0, 0, S, S)
    g.strokeStyle = '#5b5f68'
    g.lineWidth = 5
    for (const a of AVENUES) {
      g.beginPath()
      g.moveTo(X(a), Z(-EDGE))
      g.lineTo(X(a), Z(EDGE))
      g.moveTo(X(-EDGE), Z(a))
      g.lineTo(X(EDGE), Z(a))
      g.stroke()
    }
    g.strokeStyle = '#e2553a'
    g.lineWidth = 3
    for (const [x1, z1, x2, z2] of ROADBLOCKS) {
      const mx = (x1 + x2) / 2
      const mz = (z1 + z2) / 2
      g.beginPath()
      g.moveTo(X(mx) - (x1 === x2 ? 6 : 0), Z(mz) - (x1 === x2 ? 0 : 6))
      g.lineTo(X(mx) + (x1 === x2 ? 6 : 0), Z(mz) + (x1 === x2 ? 0 : 6))
      g.stroke()
    }
    for (const d of hud.drops) {
      g.fillStyle = d.hit ? '#7d8592' : '#3cff8a'
      g.beginPath()
      g.arc(X(d.x), Z(d.z), 6, 0, Math.PI * 2)
      g.fill()
    }
    for (const r of hud.rivals) {
      g.fillStyle = '#ff8a7a'
      g.fillRect(X(r.x) - 3.5, Z(r.z) - 3.5, 7, 7)
    }
    // you: an arrow
    const { x, z, heading } = hud.car
    g.save()
    g.translate(X(x), Z(z))
    g.rotate(-heading + Math.PI)
    g.fillStyle = '#ffd23a'
    g.beginPath()
    g.moveTo(0, -8)
    g.lineTo(5.5, 6)
    g.lineTo(-5.5, 6)
    g.closePath()
    g.fill()
    g.restore()
  }, [hud])
  return <canvas ref={ref} className="sprint-radar" width={150} height={150} aria-label="Map" />
}

function Pedal({ action, label, className = '' }) {
  const set = (v) => (sprintInput.touch[action] = v)
  return (
    <button
      className={`sprint-pedal ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerLeave={() => set(false)}
      onPointerCancel={() => set(false)}
    >
      {label}
    </button>
  )
}

export default function WireSprintMode({ params = {}, onFinish }) {
  const active = useSprint((s) => s.active)
  const started = useSprint((s) => s.started)
  const ended = useSprint((s) => s.ended)
  const hud = useSprint((s) => s.hud)
  const [result, setResult] = useState(null)

  useEffect(() => {
    useSprint.getState().start(params)
    const down = (e) => {
      if (KEYS[e.code]) {
        sprintInput.keys.add(KEYS[e.code])
        e.preventDefault()
      }
    }
    const up = (e) => KEYS[e.code] && sprintInput.keys.delete(KEYS[e.code])
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      useSprint.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ended && !result && race.current) setResult(sprintResult(race.current))
  }, [ended, result])

  if (!active) return null
  if (!started)
    return (
      <div className="fee-intro">
        <h2>Beat-the-Bet Wire Sprint</h2>
        <p>Wuse, Abuja, at dusk. The bet closes in ninety seconds. Hit the three drop points (a bank and two bureaux de change) in any order before the clock runs out, and before either rival bettor's driver gets all three: then the pool is cleared.</p>
        <ul className="move-list">
          <li>
            <strong>The green beams are the drops.</strong> The radar (top right) shows them, the rivals (red) and you (yellow).
          </li>
          <li>
            <strong>Blue arrows on the road</strong> give a few seconds of boost.
          </li>
          <li>
            <strong>Police roadblocks</strong> close some avenues: go round, or through an alley. Alleys are shortcuts the rivals don't take, but there are carts in them.
          </li>
          <li>Hitting a wall or a barrier kills your speed.</li>
        </ul>
        <p className="muted">Arrows / WASD: steer, gas, brake (Space brakes too). On a phone: the pedals.</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            useSprint.getState().begin()
            briefSprint()
          }}
        >
          Floor it
        </button>
      </div>
    )
  if (ended && result) {
    const won = result.outcome === 'won'
    return (
      <div className="fee-intro">
        <h2>{result.headline}</h2>
        <p>{result.line}</p>
        <p>
          Score {result.score}
          {result.moneyChange && !params.recreational ? ` · +${formatNaira(result.moneyChange)}` : ''}
        </p>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => onFinish(result)}>
            Continue
          </button>
          {won && (
            <button
              className="btn"
              onClick={() =>
                openShareCard({
                  kicker: 'The Maitama Mirage · Abuja',
                  title: 'Beat the bet',
                  line: result.line,
                  stats: [
                    ['Drops', '3/3'],
                    ['Time left', `${Math.round(race.current?.time ?? 0)}s`],
                    ['Score', result.score],
                  ],
                  tone: 'gold',
                })
              }
            >
              Share
            </button>
          )}
          {!won && !params.online && (
            <button
              className="btn"
              onClick={() => {
                setResult(null)
                useSprint.getState().retry()
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="sprint-hud">
        <div className="sprint-clock">
          <strong className={hud && hud.time < 15 ? 'is-late' : ''}>{clock(hud?.time ?? 90)}</strong>
          <span>
            {hud?.speed ?? 0} km/h {hud?.boost ? '· BOOST' : ''}
          </span>
        </div>
        <ul className="sprint-drops">
          {(hud?.drops || []).map((d) => (
            <li key={d.name} className={d.hit ? 'is-hit' : ''}>
              {d.hit ? '✓' : '○'} {d.name} {d.hit ? '' : <small>{d.dist} m</small>}
            </li>
          ))}
        </ul>
        <ul className="sprint-rivals">
          {(hud?.rivals || []).map((r) => (
            <li key={r.name}>
              {r.name}: {r.hits}/3
            </li>
          ))}
        </ul>
      </div>
      {hud && <Radar hud={hud} />}
      <div className="sprint-pedals">
        <div className="sprint-steer">
          <Pedal action="left" label="◀" />
          <Pedal action="right" label="▶" />
        </div>
        <div className="sprint-feet">
          <Pedal action="brake" label="BRAKE" className="is-brake" />
          <Pedal action="gas" label="GAS" className="is-gas" />
        </div>
      </div>
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => {
            const s = race.current
            if (s) {
              s.drops.forEach((d) => (d.hit = true))
              Object.assign(s, { over: true, won: true, why: 'done' })
            }
            useSprint.setState({ ended: true })
          }}
        >
          Win (dev)
        </button>
      )}
    </>
  )
}
