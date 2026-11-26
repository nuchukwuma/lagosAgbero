import { useEffect, useState } from 'react'
import { useCourse, course, courseInput } from './courseStore.js'
import { courseResult, COURSES } from './courseLogic.js'
import { formatNaira } from '../../narrative/stats.js'
import { openShareCard } from '../../../components/share/shareCard.js'

// The course runs' overlay: intro, the clock and the way still to go, what you
// have left (boat, truck, crates, convoy), the pedals, the result.

const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'brake' }
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const COURSE_TEXT = {
  creekRun: {
    title: 'Creek Skiff Run',
    place: 'Port Harcourt creeks',
    intro: 'The cargo is in the skiff and a rival crew has seen you leave the jetty. Two boats are coming. Get down the creek to the pick-up point before they catch you.',
    rules: ['Logs and drums float in the water: each one you hit holes the boat (four and she sinks).', 'Blue arrows on the water give a few seconds of extra speed.', 'Slow down and the rival boats close in. If one comes alongside, it is over.', 'Bends push you to the outside bank: steer into them.'],
    go: 'Open the throttle',
    stats: (m) => [['Boat', `${m.c.damage - m.damage}/${m.c.damage}`], ['Time left', `${Math.round(m.time)}s`]],
    tone: 'green',
  },
  customsBreakout: {
    title: 'Customs Checkpoint Breakout',
    place: 'The expressway out of Computer Village',
    intro: 'A container of phones, no papers. The expressway to the warehouse has customs inspection lines across it, police cars on patrol and tyre spikes on the tarmac. Get the truck through.',
    rules: ['At every customs line only one lane is open (the green gantry marks it). Hit a barrier and it costs you.', 'Tyre spikes and police cars dent the truck: five hits and it is finished.', 'The truck is wide and slow to turn: line up early.'],
    go: 'Start the engine',
    stats: (m) => [['Dents', m.damage], ['Time left', `${Math.round(m.time)}s`]],
    tone: 'gold',
  },
  cartDash: {
    title: 'Market Cart Dash',
    place: 'Computer Village market lanes',
    intro: 'Six crates of stock on a pushcart, and the shop closes soon. Push through the market lanes without losing the load.',
    rules: ['Take a corner too fast, or swerve hard, and the load leans (it shows in red): a crate falls off.', 'Shoppers cross the lane: run into one and you stop dead.', 'The Task Force has half the lane blocked here and there: hit them and they seize a crate. Squeeze through the gap.'],
    go: 'Push',
    stats: (m) => [['Crates', `${m.crates}/${m.c.crates}`], ['Time left', `${Math.round(m.time)}s`]],
    tone: 'gold',
  },
  convoyEscort: {
    title: 'Convoy Escort',
    place: 'Maitama, Abuja',
    intro: "Oga's convoy is moving, and the other side has cars ready to pull out and block the road. Drive ahead of the convoy and ram every blocker off the road before the convoy reaches it.",
    rules: ['Red cars pulling across the road are blockers. Hit them fast (over 30 km/h) to shove them off; slow and you just stop.', 'Every blocker the convoy runs into costs it a car; lose all three and the convoy is stuck.', 'Stay ahead of the convoy: you can only clear what is in front of it.'],
    go: 'Move',
    stats: (m) => [['Blockers off', m.rammed], ['Convoy', `${m.convoy?.health ?? 0}/${m.c.convoyHealth}`]],
    tone: 'gold',
  },
}

function Pedal({ action, label, className = '' }) {
  const set = (v) => (courseInput.touch[action] = v)
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

const pips = (left, max, on = '●', off = '○') => on.repeat(Math.max(0, left)) + off.repeat(Math.max(0, max - left))

export default function CourseMode({ id, params = {}, onFinish }) {
  const active = useCourse((s) => s.active)
  const started = useCourse((s) => s.started)
  const ended = useCourse((s) => s.ended)
  const hud = useCourse((s) => s.hud)
  const [result, setResult] = useState(null)
  const T = COURSE_TEXT[id]
  const c = COURSES[id]

  useEffect(() => {
    useCourse.getState().start(id, params)
    const down = (e) => {
      if (KEYS[e.code]) {
        courseInput.keys.add(KEYS[e.code])
        e.preventDefault()
      }
    }
    const up = (e) => KEYS[e.code] && courseInput.keys.delete(KEYS[e.code])
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      useCourse.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (ended && !result && course.current) setResult(courseResult(course.current))
  }, [ended, result])

  if (!active) return null
  if (!started)
    return (
      <div className="fee-intro">
        <h2>{T.title}</h2>
        <p>{T.intro}</p>
        <ul className="move-list">
          {T.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="muted">Arrows / WASD: steer, gas, brake (Space brakes too). On a phone: the pedals.</p>
        <button className="btn btn-primary" onClick={() => useCourse.getState().begin()}>
          {T.go}
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
          {won && course.current && (
            <button
              className="btn"
              onClick={() =>
                openShareCard({
                  kicker: `${T.title} · ${T.place}`,
                  title: result.headline,
                  line: result.line,
                  stats: [...T.stats(course.current), ['Score', result.score]],
                  tone: T.tone,
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
                useCourse.getState().retry()
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
  return (
    <>
      <div className="sprint-hud">
        <div className="sprint-clock">
          <strong className={h && h.time < 15 ? 'is-late' : ''}>{clock(h?.time ?? c.time)}</strong>
          <span>
            {id === 'cartDash' ? (h?.speed > 25 ? 'Running' : 'Walking') : `${h?.speed ?? 0} km/h`} {h?.boost ? '· BOOST' : ''}
          </span>
        </div>
        <div className="sprint-clock course-progress">
          <span>{id === 'convoyEscort' ? 'Convoy' : 'Way'}</span>
          <div className="stealth-bar">
            <i style={{ width: `${Math.round((h?.done ?? 0) * 100)}%` }} />
          </div>
        </div>
        <ul className="sprint-drops">
          {c.damage ? <li>{id === 'creekRun' ? 'Boat' : 'Truck'} {pips((h?.maxDamage ?? c.damage) - (h?.damage ?? 0), c.damage, '■', '□')}</li> : null}
          {c.crates ? (
            <li className={h?.tipping ? 'course-tip' : ''}>
              Crates {pips(h?.crates ?? c.crates, c.crates, '■', '□')} {h?.tipping ? 'LEANING!' : ''}
            </li>
          ) : null}
          {h?.convoy && (
            <li>
              Convoy {pips(h.convoy.health, h.convoy.max, '■', '□')} · you are {h.convoy.ahead >= 0 ? `${h.convoy.ahead} m ahead` : `${-h.convoy.ahead} m behind`}
            </li>
          )}
          {h?.rivalGap != null && <li className={h.rivalGap < 15 ? 'course-tip' : ''}>Rival boats {h.rivalGap} m behind</li>}
        </ul>
      </div>
      <div className="sprint-pedals">
        <div className="sprint-steer">
          <Pedal action="left" label="◀" />
          <Pedal action="right" label="▶" />
        </div>
        <div className="sprint-feet">
          <Pedal action="brake" label="BRAKE" className="is-brake" />
          <Pedal action="gas" label={id === 'cartDash' ? 'PUSH' : 'GAS'} className="is-gas" />
        </div>
      </div>
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => {
            const m = course.current
            if (m) Object.assign(m, { over: true, won: true, why: 'done' })
            useCourse.setState({ ended: true })
          }}
        >
          Win (dev)
        </button>
      )}
    </>
  )
}
