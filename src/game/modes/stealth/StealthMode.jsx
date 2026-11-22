import { useEffect, useState } from 'react'
import { useStealth, mission } from './stealthStore.js'
import { takedown, missionResult } from './stealthLogic.js'
import { doTakedown } from './StealthDirector.jsx'
import { useGameStore } from '../../store/gameStore.js'
import { playerState } from '../../world/worldState.js'
import { input } from '../../player/input.js'
import MoveControls from '../../../components/hud/MoveControls.jsx'
import TaskPanel from '../../../components/hud/TaskPanel.jsx'
import PowerupOffer from '../../../components/hud/PowerupOffer.jsx'
import { formatNaira } from '../../narrative/stats.js'

// Back Gate: the overlay for the 3D stealth mission (StealthDirector runs the
// night inside the campus). Intro, the mission panel, TAKE DOWN, the result.

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function StealthMode({ params = {}, onFinish }) {
  const active = useStealth((s) => s.active)
  const started = useStealth((s) => s.started)
  const ended = useStealth((s) => s.ended)
  const hud = useStealth((s) => s.hud)
  const [result, setResult] = useState(null)
  const online = Boolean(params.online)

  useEffect(() => {
    // remember where you stood: you're put back there after the night
    const home = { x: playerState.position.x, z: playerState.position.z, facing: playerState.facing }
    const world = useGameStore.getState().view?.world
    useStealth.getState().start(params)
    return () => {
      input.runButton = false
      useStealth.getState().reset()
      if (world === 'royalCrest') playerState.teleport = home // same place: straight back
      else playerState.restore = home // GameCanvas puts you back once your own world is loaded again
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ended && !result && mission.current) setResult(missionResult(mission.current))
  }, [ended, result])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'KeyE' || e.key === 'Enter') && useStealth.getState().started) doTakedown(takedown)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!active) return null
  if (!started)
    return (
      <div className="fee-intro">
        <h2>Back Gate</h2>
        <p>Night on campus. The porter has locked the hostel and the guards are walking their rounds with torches. Get out through the back gate before dawn.</p>
        <ul className="move-list">
          <li>
            <strong>Stay out of the torch beams.</strong> In a beam, a <b>?</b> fills over the guard's head; when it's full, he runs for you. Containers, bins and walls block his view.
          </li>
          <li>
            <strong>Walk, don't run.</strong> You move crouched. Running is quicker, but guards close by hear it.
          </li>
          <li>
            <strong>Take them down from behind:</strong> get next to a guard who hasn't seen you and press <b>TAKE DOWN</b> (E). He drops his money. A guard who finds a sleeping colleague comes looking.
          </li>
          <li>
            <strong>Every guard asleep opens the back gate.</strong> Caught, you start again from the hostel ({hud.tries || 3} tries).
          </li>
        </ul>
        <p className="muted">Move with the stick or WASD / arrows; turn the camera by dragging, or V.</p>
        <PowerupOffer mode="sneak" />
        <button className="btn btn-primary" onClick={() => useStealth.getState().begin()}>
          Sneak out
        </button>
      </div>
    )
  if (ended && result) {
    const won = result.outcome === 'won'
    return (
      <div className="fee-intro">
        <h2>{result.headline}</h2>
        <p>{result.line}</p>
        <p>Score {result.score}{result.moneyChange && !params.recreational ? ` · +${formatNaira(result.moneyChange)}` : ''}</p>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => onFinish(result)}>
            Continue
          </button>
          {!won && !online && (
            <button
              className="btn"
              onClick={() => {
                setResult(null)
                useStealth.getState().retry()
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  const can = hud.canTakedown != null
  return (
    <>
      <TaskPanel className={hud.chased ? 'is-danger' : ''}>
        <div className="fee-row">
          <strong>BACK GATE</strong>
          <span>🌅 {clock(hud.time)}</span>
        </div>
        <div className="fee-row">
          <span>{hud.open ? 'The gate is open: go!' : `Guards awake: ${hud.left} of ${hud.total}`}</span>
          <span>
            {'♥'.repeat(Math.max(0, hud.tries))} · {formatNaira(hud.cash)}
          </span>
        </div>
        {hud.chased && <div className="fee-row stealth-warn">He has seen you! Break his line of sight.</div>}
      </TaskPanel>
      {hud.caught && <div className="stealth-caught">Caught! Back to the hostel.</div>}
      <MoveControls actionLabel={can ? 'TAKE DOWN' : null} actionIcon="fist" actionSub={can ? 'take down' : null} onAction={() => doTakedown(takedown)} />
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => {
            const m = mission.current
            if (m) Object.assign(m, { over: true, won: true })
            useStealth.setState({ ended: { over: true } })
          }}
        >
          Win (dev)
        </button>
      )}
    </>
  )
}
