import { useEffect, useState } from 'react'
import { useTurf, turf, turfInput } from './turfStore.js'
import { turfResult, TEAMS, TARGET, TIME } from './turfLogic.js'
import Joystick from '../../../components/hud/Joystick.jsx'
import { useDevice } from '../../../components/hud/useDevice.js'
import { formatNaira } from '../../narrative/stats.js'
import { openShareCard } from '../../../components/share/shareCard.js'

// Turf Flag Brawl: the overlay. Intro, the score race, the three flags, the
// stick (or WASD) and SHOVE (Space / E), the result.

const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const shoveNow = () => (turfInput.shove = true)

export default function TurfMode({ params = {}, onFinish }) {
  const active = useTurf((s) => s.active)
  const started = useTurf((s) => s.started)
  const ended = useTurf((s) => s.ended)
  const hud = useTurf((s) => s.hud)
  const { touch } = useDevice()
  const [result, setResult] = useState(null)

  useEffect(() => {
    useTurf.getState().start(params)
    const down = (e) => {
      if (KEYS[e.code]) {
        turfInput.keys.add(KEYS[e.code])
        e.preventDefault()
      } else if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) {
        shoveNow()
        e.preventDefault()
      }
    }
    const up = (e) => KEYS[e.code] && turfInput.keys.delete(KEYS[e.code])
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      useTurf.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ended && !result && turf.current) setResult(turfResult(turf.current))
  }, [ended, result])

  if (!active) return null
  if (!started)
    return (
      <div className="fee-intro">
        <h2>Turf Flag Brawl</h2>
        <p>
          A waterfront yard on a Port Harcourt creek, at dusk. Three flags: the jetty, the drums, the boathouse. You and two of the {TEAMS.you.name} against three {TEAMS.them.name}. Whoever holds the flags holds the yard.
        </p>
        <ul className="move-list">
          <li>
            <strong>Stand in a flag&apos;s ring</strong> with none of them in it and your red goes up the pole (faster with two of you). Both sides in the ring: it does not move.
          </li>
          <li>
            <strong>A flag you hold scores a point a second.</strong> First to {TARGET}, or ahead after {Math.round(TIME / 60)} minutes, takes the turf.
          </li>
          <li>
            <strong>SHOVE</strong> knocks them back. Shoved off the yard, they are in the creek and out for a few seconds. So are you.
          </li>
        </ul>
        <p className="muted">WASD / arrows: move · Space or E: shove. On a phone: the stick and SHOVE.</p>
        <button className="btn btn-primary" onClick={() => useTurf.getState().begin()}>
          Take the yard
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
          {won && turf.current && (
            <button
              className="btn"
              onClick={() =>
                openShareCard({
                  kicker: 'Turf Flag Brawl · Port Harcourt',
                  title: 'The waterfront is ours',
                  line: result.line,
                  stats: [
                    ['Score', `${turf.current.score.you}–${turf.current.score.them}`],
                    ['In the creek', turf.current.stats.dunked],
                    ['Flags raised', turf.current.stats.captures],
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
                useTurf.getState().retry()
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }
  const h = hud
  const you = h?.score.you ?? 0
  const them = h?.score.them ?? 0
  return (
    <>
      <div className="sprint-hud">
        <div className="sprint-clock">
          <strong className={h && h.time < 15 ? 'is-late' : ''}>{clock(h?.time ?? TIME)}</strong>
          <span className="turf-score">
            <b style={{ color: TEAMS.you.color }}>{you}</b> – <b style={{ color: '#5aa9e6' }}>{them}</b> <small>first to {TARGET}</small>
          </span>
        </div>
        <ul className="sprint-drops turf-flags">
          {(h?.flags || []).map((f) => (
            <li key={f.id} className={f.contested ? 'course-tip' : ''}>
              <i style={{ background: f.owner === 'you' ? TEAMS.you.color : f.owner === 'them' ? TEAMS.them.color : '#7d8592' }} />
              {f.label} {f.contested ? '· contested' : f.owner === 'you' ? '· ours' : f.owner === 'them' ? '· theirs' : `· ${Math.round(Math.abs(f.p) * 100)}%`}
            </li>
          ))}
          {h?.out ? <li className="course-tip">In the creek: back in {h.out}…</li> : null}
        </ul>
      </div>
      <div className="sprint-pedals turf-controls">
        <div className="sprint-steer">{touch ? <Joystick onMove={(x, y) => (turfInput.stick = { x, y })} className="fight-stick" /> : <span />}</div>
        <div className="sprint-feet">
          <button
            className={`sprint-pedal is-gas ${h?.cd > 0 ? 'is-cooling' : ''}`}
            aria-label="Shove"
            onPointerDown={(e) => {
              e.preventDefault()
              shoveNow()
            }}
          >
            SHOVE
            {!touch && <kbd className="fight-key">Space</kbd>}
          </button>
        </div>
      </div>
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => {
            const t = turf.current
            if (t) Object.assign(t, { over: true, won: true, why: 'target', score: { you: TARGET, them: 0 } })
            useTurf.setState({ ended: true })
          }}
        >
          Win (dev)
        </button>
      )}
    </>
  )
}
