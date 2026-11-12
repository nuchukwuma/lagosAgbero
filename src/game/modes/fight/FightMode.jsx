import { useEffect, useState } from 'react'
import { useFight, fightInput } from './fightStore.js'
import { useDevice } from '../../../components/hud/useDevice.js'

// Fight overlay: health bars, special meter, buttons (touch) or keys.
// Keys: A/D or ←/→ move · J punch · K kick · L block (hold) · Space dodge · U special

const KEYS = {
  KeyJ: 'punch',
  KeyK: 'kick',
  KeyU: 'special',
  Space: 'dodge',
}

function Bar({ value, max, color, label, right }) {
  return (
    <div className={`fight-bar ${right ? 'right' : ''}`}>
      <div className="fight-name">{label}</div>
      <div className="fight-track">
        <div className="fight-fill" style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  )
}

function HoldButton({ action, label, className = '' }) {
  return (
    <button
      className={`fight-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        if (action === 'block') fightInput.block = true
        else if (action === 'left') fightInput.move = -1
        else if (action === 'right') fightInput.move = 1
        else fightInput[action] = true
      }}
      onPointerUp={() => {
        if (action === 'block') fightInput.block = false
        if (action === 'left' || action === 'right') fightInput.move = 0
      }}
      onPointerLeave={() => {
        if (action === 'block') fightInput.block = false
        if (action === 'left' || action === 'right') fightInput.move = 0
      }}
    >
      {label}
    </button>
  )
}

export default function FightMode({ params, onFinish }) {
  const fight = useFight()
  const { touch } = useDevice()
  const [result, setResult] = useState(null)

  useEffect(() => {
    useFight.getState().start(params)
    return () => useFight.getState().reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (fight.ended && !result) setResult(useFight.getState().result())
  }, [fight.ended, result])

  useEffect(() => {
    const down = (e) => {
      if (KEYS[e.code]) {
        fightInput[KEYS[e.code]] = true
        e.preventDefault()
      }
      if (e.code === 'KeyL') fightInput.block = true
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') fightInput.move = -1
      if (e.code === 'KeyD' || e.code === 'ArrowRight') fightInput.move = 1
    }
    const up = (e) => {
      if (e.code === 'KeyL') fightInput.block = false
      if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && fightInput.move < 0) fightInput.move = 0
      if ((e.code === 'KeyD' || e.code === 'ArrowRight') && fightInput.move > 0) fightInput.move = 0
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  if (!fight.active) return null
  if (!fight.started)
    return (
      <div className="fee-intro">
        <h2>Fight! {fight.hud.name}</h2>
        <p>Punch, kick, block and dodge. Land hits to fill your meter, then unleash the <strong>Lagos Roundabout</strong>.</p>
        <p className="muted">{touch ? 'Buttons: ◀ ▶ move · PUNCH · KICK · BLOCK (hold) · DODGE · SPECIAL' : 'Keys: A/D move · J punch · K kick · L block (hold) · Space dodge · U special'}</p>
        <button className="btn btn-primary" onClick={fight.begin}>
          Oya!
        </button>
      </div>
    )
  if (fight.ended && result)
    return (
      <div className="fee-intro">
        <h2>{result.outcome === 'won' ? 'K.O.! You win!' : 'You don fall...'}</h2>
        <p className="muted">
          Damage dealt {Math.round(fight.stats.dealt)} · taken {Math.round(fight.stats.taken)}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(result)}>
          Continue
        </button>
      </div>
    )

  const { php, pmax, ohp, omax, special, name } = fight.hud
  return (
    <>
      <div className="fight-hud">
        <Bar value={php} max={pmax} color="#8ff0a4" label="You" />
        <div className="fight-vs">VS</div>
        <Bar value={ohp} max={omax} color="#e2553a" label={name} right />
      </div>
      <div className="fight-special">
        <div style={{ width: `${special}%` }} className={special >= 100 ? 'full' : ''} />
        <span>{special >= 100 ? 'SPECIAL READY!' : 'Special'}</span>
      </div>
      {touch ? (
        <div className="fight-controls">
          <div className="fight-move">
            <HoldButton action="left" label="◀" />
            <HoldButton action="right" label="▶" />
          </div>
          <div className="fight-actions">
            <HoldButton action="block" label="BLOCK" className="block" />
            <HoldButton action="dodge" label="DODGE" />
            <HoldButton action="kick" label="KICK" />
            <HoldButton action="punch" label="PUNCH" className="big" />
            <HoldButton action="special" label="SPECIAL" className={special >= 100 ? 'ready' : 'dim'} />
          </div>
        </div>
      ) : (
        <div className="keyboard-hint">A/D move · J punch · K kick · L block · Space dodge · U special</div>
      )}
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => fight.end('won')}>
          Win (dev)
        </button>
      )}
    </>
  )
}
