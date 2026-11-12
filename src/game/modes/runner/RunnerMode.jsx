import { useEffect, useRef, useState } from 'react'
import { useRunner, runnerInput } from './runnerStore.js'
import { useDevice } from '../../../components/hud/useDevice.js'

// Escape run overlay: distance, stumbles, pursuers; swipe (or arrow keys /
// WASD / Space) to change lane, jump and slide.
export default function RunnerMode({ params, onFinish }) {
  const runner = useRunner()
  const { touch } = useDevice()
  const [result, setResult] = useState(null)
  const swipe = useRef(null)

  useEffect(() => {
    useRunner.getState().start(params)
    return () => useRunner.getState().reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (runner.ended && !result) setResult(useRunner.getState().result())
  }, [runner.ended, result])

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') runnerInput.left = true
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') runnerInput.right = true
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') runnerInput.jump = true
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') runnerInput.slide = true
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  if (!runner.active) return null
  if (!runner.started)
    return (
      <div className="fee-intro">
        <h2>RUN!</h2>
        <p>{params.chaser === 'hyenas' ? 'The Hyenas dey behind you.' : 'Task Force dey behind you!'} Reach {params.goal ?? 320} m to escape. Grab naira notes on the way.</p>
        <p className="muted">{touch ? 'Swipe left/right to change lane, up to jump cartons, down to slide under banners.' : '←/→ or A/D change lane · ↑/W/Space jump · ↓/S slide'}</p>
        <button className="btn btn-primary" onClick={runner.begin}>
          Go!
        </button>
      </div>
    )
  if (runner.ended && result)
    return (
      <div className="fee-intro">
        <h2>{result.outcome === 'escaped' ? 'You don escape!' : 'Dem catch you!'}</h2>
        <p className="muted">
          Distance {Math.round(runner.hud.distance)} m · Naira notes {runner.hud.notes} (₦{(runner.hud.notes * 100).toLocaleString('en-NG')})
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(result)}>
          Continue
        </button>
      </div>
    )

  const { distance, goal, hits, maxHits, notes, pursuer } = runner.hud
  return (
    <>
      <div
        className="swipe-zone"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
          if (Math.abs(dx) > Math.abs(dy)) runnerInput[dx < 0 ? 'left' : 'right'] = true
          else runnerInput[dy < 0 ? 'jump' : 'slide'] = true
        }}
      />
      <div className="fee-hud">
        <div className="fee-row">
          <strong>ESCAPE</strong>
          <span>
            {Math.round(distance)} / {goal} m
          </span>
        </div>
        <div className="fee-quota">
          <div style={{ width: `${(distance / goal) * 100}%` }} />
        </div>
        <div className="fee-row">
          <span>Stumbles {hits}/{maxHits} · ₦ notes {notes}</span>
          <span className={pursuer < 6 ? 'warn' : 'muted'}>They're {Math.max(0, Math.round(pursuer))} m behind</span>
        </div>
      </div>
      {!touch && <div className="keyboard-hint">←/→ change lane · ↑ jump · ↓ slide</div>}
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => runner.end('escaped')}>
          Escape (dev)
        </button>
      )}
    </>
  )
}
