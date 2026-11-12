import { useEffect, useState } from 'react'
import { useChase } from './chaseStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { input } from '../../player/input.js'
import MoveControls from '../../../components/hud/MoveControls.jsx'

// The chase on foot. Overlay: intro, stamina, distance, GRAB, result.
export default function ChaseMode({ params, onFinish }) {
  const chase = useChase()
  const stats = useGameStore((s) => s.game?.stats)
  const [result, setResult] = useState(null)

  useEffect(() => {
    useChase.getState().start(params, stats || {})
    return () => {
      input.runButton = false
      useChase.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (chase.ended && !result) setResult(useChase.getState().result())
  }, [chase.ended, result])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.key === 'Enter') useChase.getState().grab()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!chase.active) return null
  if (!chase.started)
    return (
      <div className="fee-intro">
        <h2>Chase am!</h2>
        <p>The danfo dey crawl for go-slow. Run along the pavement, dodge people, and press <strong>GRAB</strong> when you reach the door.</p>
        <p className="muted">Running uses stamina (it starts from your energy). Walk small to catch breath. Trick: traffic go stop if you stand for road in front of am.</p>
        <button className="btn btn-primary" onClick={chase.begin}>
          Oya, run!
        </button>
      </div>
    )
  if (chase.ended && result)
    return (
      <div className="fee-intro">
        <h2>{result.outcome === 'won' ? 'You catch am!' : chase.reason === 'time' ? 'E don tire you' : 'E don escape!'}</h2>
        <p className="muted">
          Energy used: {-(result.stats.energy || 0)} · Bumped into people: {chase.bumps}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(result)}>
          Continue
        </button>
      </div>
    )

  const pct = (chase.stamina / chase.maxStamina) * 100
  return (
    <>
      <div className="fee-hud">
        <div className="fee-row">
          <strong>CHASE</strong>
          <span>⏱ {Math.ceil(chase.timeLeft)}s</span>
        </div>
        <div className="fee-row">
          <span>Stamina</span>
          <span>{chase.distance != null ? `${chase.distance.toFixed(0)} m to the door` : ''}</span>
        </div>
        <div className="fee-quota">
          <div style={{ width: `${pct}%`, background: pct < 25 ? '#e2553a' : '#8ff0a4' }} />
        </div>
      </div>
      <MoveControls actionLabel={chase.canGrab ? 'GRAB' : null} actionIcon="hand" onAction={chase.grab} />
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => chase.end('won', 'dev')}>
          Win (dev)
        </button>
      )}
    </>
  )
}
