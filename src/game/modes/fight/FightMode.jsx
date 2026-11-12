import { useEffect, useState } from 'react'
import { useFight, fightInput } from './fightStore.js'
import { useDevice } from '../../../components/hud/useDevice.js'
import Icon from '../../../components/Icon.jsx'

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

function HoldButton({ action, icon, label, className = '' }) {
  return (
    <button
      className={`fight-btn ${className}`}
      aria-label={label}
      title={label}
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
      <Icon name={icon} size={className.includes('big') ? 40 : 32} />
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
        <p>Punch, kick, block and dodge. Land hits to fill your meter, then unleash the <strong>Lagos Roundabout</strong>. Hits landed close together build a <strong>combo</strong>: each one hits harder.</p>
        <p className="muted">{touch ? (
            <span className="icon-legend">
              <Icon name="fist" size={18} /> punch <Icon name="boot" size={18} /> kick <Icon name="shield" size={18} /> block (hold) <Icon name="dodge" size={18} /> dodge <Icon name="bolt" size={18} /> special
            </span>
          ) : (
            'Keys: A/D move · J punch · K kick · L block (hold) · Space dodge · U special'
          )}</p>
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

  const { php, pmax, ohp, omax, special, name, combo = 0 } = fight.hud
  return (
    <>
      <div className="fight-hud">
        <Bar value={php} max={pmax} color="#8ff0a4" label="You" />
        <div className="fight-vs">VS</div>
        <Bar value={ohp} max={omax} color="#e2553a" label={name} right />
      </div>
      {combo >= 2 && (
        <div className="fight-combo" key={combo}>
          x{combo} <small>COMBO</small>
        </div>
      )}
      <div className="fight-special">
        <div style={{ width: `${special}%` }} className={special >= 100 ? 'full' : ''} />
        <span>{special >= 100 ? 'SPECIAL READY!' : 'Special'}</span>
      </div>
      {touch ? (
        <div className="fight-controls">
          <div className="fight-move">
            <HoldButton action="left" icon="left" label="Move left" />
            <HoldButton action="right" icon="right" label="Move right" />
          </div>
          <div className="fight-actions">
            <HoldButton action="block" icon="shield" label="Block (hold)" className="block" />
            <HoldButton action="dodge" icon="dodge" label="Dodge" />
            <HoldButton action="kick" icon="boot" label="Kick" />
            <HoldButton action="punch" icon="fist" label="Punch" className="big" />
            <HoldButton action="special" icon="bolt" label="Special move" className={special >= 100 ? 'ready' : 'dim'} />
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
