import { useEffect, useRef, useState } from 'react'
import { useRunner, runnerInput, bestDistance } from './runnerStore.js'
import { useDevice } from '../../../components/hud/useDevice.js'
import Icon from '../../../components/Icon.jsx'
import { CHASERS } from './RunnerScene.jsx'
import TaskPanel from '../../../components/hud/TaskPanel.jsx'

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
        <h2>{params.endless ? 'THE GAUNTLET' : 'RUN!'}</h2>
        {params.endless ? (
          <p>
            {(CHASERS[params.chaser] || CHASERS.taskForce).text} There's no finish line: the road keeps coming and the pace keeps rising. Go as far as you can.
            {bestDistance() > 0 && <> Your best: <strong>{bestDistance()} m</strong>.</>}
          </p>
        ) : (
          <p>{(CHASERS[params.chaser] || CHASERS.taskForce).text} Reach {params.goal ?? 320} m to escape. Grab naira notes on the way.</p>
        )}
        {params.endless && (params.heat > 0 || params.notoriety >= 25) && (
          <p className="warn">
            {params.heat > 0 ? `You ran here ${params.heat === 1 ? 'not long ago' : `${params.heat} times lately`}: they know the route now, so it's faster and there are more of them. ` : ''}
            {params.notoriety >= 25 ? 'Your name is known: the Task Force wants you badly. ' : ''}
            Give it a few hours and they'll ease off.
          </p>
        )}
        <p className="muted">{touch ? 'Swipe, or tap the arrows: left/right change lane, up jumps cartons, down slides under banners. Danfos and Task Force men coming at you: get out of their lane!' : '←/→ or A/D change lane · ↑/W/Space jump · ↓/S slide · dodge the danfos and officers coming at you'}</p>
        <button className="btn btn-primary" onClick={runner.begin}>
          Go!
        </button>
      </div>
    )
  if (runner.ended && result)
    return (
      <div className="fee-intro">
        <h2>{result.outcome === 'escaped' ? 'You don escape!' : result.metres != null ? (result.newBest ? 'New best!' : 'Dem catch you!') : 'Dem catch you!'}</h2>
        {result.metres != null && (
          <p>
            <strong>{result.metres} m</strong> · best {result.best} m · earned ₦{(result.moneyChange || 0).toLocaleString('en-NG')}
          </p>
        )}
        {result.metres == null && (
          <p className="muted">
            Distance {Math.round(runner.hud.distance)} m · Naira notes {runner.hud.notes} (₦{(runner.hud.notes * 100).toLocaleString('en-NG')})
          </p>
        )}
        <button className="btn btn-primary" onClick={() => onFinish(result)}>
          Continue
        </button>
      </div>
    )

  const { distance, goal, hits, maxHits, notes, pursuer, endless, close } = runner.hud
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
      <TaskPanel>
        <div className="fee-row">
          <strong>{endless ? 'GAUNTLET' : 'ESCAPE'}</strong>
          <span>{endless ? `${Math.round(distance)} m · best ${bestDistance()} m` : `${Math.round(distance)} / ${goal} m`}</span>
        </div>
        {!endless && (
          <div className="fee-quota">
            <div style={{ width: `${(distance / goal) * 100}%` }} />
          </div>
        )}
        <div className="fee-row">
          <span>Stumbles {hits}/{maxHits} · ₦ notes {notes}</span>
          <span className={close || pursuer < 6 ? 'warn' : 'muted'}>{close ? 'On your back!' : `They're ${Math.max(0, Math.round(pursuer))} m behind`}</span>
        </div>
      </TaskPanel>
      {close && <div className="runner-alarm">{(CHASERS[params.chaser] || CHASERS.taskForce).back || 'DEM DEY YOUR BACK!'}</div>}
      {touch ? (
        <div className="runner-pad">
          <button className="fight-btn" aria-label="Lane left" onPointerDown={() => (runnerInput.left = true)}>
            <Icon name="left" size={30} />
          </button>
          <div className="runner-pad-mid">
            <button className="fight-btn" aria-label="Jump" onPointerDown={() => (runnerInput.jump = true)}>
              <Icon name="up" size={30} />
            </button>
            <button className="fight-btn" aria-label="Slide" onPointerDown={() => (runnerInput.slide = true)}>
              <Icon name="down" size={30} />
            </button>
          </div>
          <button className="fight-btn" aria-label="Lane right" onPointerDown={() => (runnerInput.right = true)}>
            <Icon name="right" size={30} />
          </button>
        </div>
      ) : (
        <div className="keyboard-hint">←/→ change lane · ↑ jump · ↓ slide</div>
      )}
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => runner.end('escaped')}>
          Escape (dev)
        </button>
      )}
    </>
  )
}
