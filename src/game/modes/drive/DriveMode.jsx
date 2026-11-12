import { useEffect, useState } from 'react'
import { useDrive, driveInput } from './driveStore.js'
import { buyFuel, checkpointChoice, fuelCost } from './driveLogic.js'
import { useDevice } from '../../../components/hud/useDevice.js'
import { useGameStore } from '../../store/gameStore.js'
import { formatNaira } from '../../narrative/stats.js'
import Icon from '../../../components/Icon.jsx'
import { sfx } from '../../audio/audio.js'

// Danfo driving: HUD, pedals, steering, horn, and the choices at filling
// stations and checkpoints. Keyboard: W/↑ gas · S/↓ brake · A/D or ←/→ steer
// · Space or H horn.

const KEYS = { KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }

function Hold({ k, icon, label, className = '' }) {
  const set = (v) => (driveInput.touch[k] = v)
  return (
    <button
      className={`drive-btn ${className}`}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
    >
      <Icon name={icon} size={34} />
    </button>
  )
}

const MARK_ICON = { stop: 'people', fuel: 'fuel', checkpoint: 'shield' }

export default function DriveMode({ params, onFinish }) {
  const store = useDrive()
  const { touch } = useDevice()
  const money = useGameStore((s) => s.game?.stats.money ?? 0)
  const goodwill = useGameStore((s) => s.game?.stats.communityGoodwill ?? 10)
  const [note, setNote] = useState(null)

  useEffect(() => {
    useDrive.getState().start(params)
    return () => useDrive.getState().reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' || e.code === 'KeyH') {
        driveInput.horn = true
        e.preventDefault()
        return
      }
      const k = KEYS[e.code]
      if (!k) return
      driveInput.keys.add(k)
      e.preventDefault()
    }
    const up = (e) => {
      const k = KEYS[e.code]
      if (k) driveInput.keys.delete(k)
    }
    const blur = () => driveInput.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => {
    if (!store.toast) return undefined
    const id = setTimeout(() => useDrive.setState({ toast: null }), 2600)
    return () => clearTimeout(id)
  }, [store.toast])

  if (!store.active) return null

  if (!store.started)
    return (
      <div className="fee-intro">
        <h2>
          <Icon name="bus" size={30} /> Drive the danfo
        </h2>
        <p>Your own route today. Fill the bus, keep it alive, bring money back.</p>
        <ul>
          <li>Pull onto the shoulder (far right) and stop at bus stops to load passengers. Don't pass anybody's stop.</li>
          <li>Watch the fuel. Stop at a filling station to buy more.</li>
          <li>Horn makes cars move. Crashes cost repairs, and some drivers come out to fight.</li>
          <li>Task Force checkpoint: stop and settle, or floor it and they'll chase you.</li>
        </ul>
        <p className="muted">{touch ? 'Left: steer · Right: gas / brake · Horn in the middle.' : 'W/↑ gas · S/↓ brake · A/D steer · Space horn.'}</p>
        <button className="btn btn-primary" onClick={store.begin}>
          <Icon name="wheel" size={20} /> Start engine
        </button>
      </div>
    )

  if (store.ended && store.result) {
    const r = store.result
    const s = r.summary
    const titles = { done: 'Last stop! Route complete.', caught: 'Task Force don catch you.', outOfFuel: 'Fuel don finish.', wrecked: 'The bus don scatter.', abandoned: 'Jump out and RUN!', roadRage: 'The other driver is coming out...' }
    return (
      <div className="fee-intro">
        <h2>{titles[r.outcome]}</h2>
        <div className="drive-summary">
          <span>Fares</span>
          <strong>{formatNaira(s.fares)}</strong>
          <span>Fuel</span>
          <strong>−{formatNaira(s.fuel)}</strong>
          <span>Settlements</span>
          <strong>−{formatNaira(s.bribes)}</strong>
          {r.outcome === 'done' && (
            <>
              <span>Repairs</span>
              <strong>−{formatNaira(s.repair)}</strong>
            </>
          )}
          <span>You take home</span>
          <strong className={r.moneyChange >= 0 ? 'good' : 'warn'}>{formatNaira(r.moneyChange)}</strong>
        </div>
        <p className="muted">
          {s.km} km · {s.crashes} crash{s.crashes === 1 ? '' : 'es'}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(r)}>
          Continue
        </button>
      </div>
    )
  }

  const h = store.hud
  const d = store.drive
  const prompt = store.prompt
  const budget = money + (h ? h.fares - h.spent : 0)

  return (
    <>
      {h && (
        <div className="drive-hud">
          <div className="drive-speed">
            <strong>{h.kmh}</strong>
            <small>km/h</small>
          </div>
          <div className="drive-meters">
            <div className={`drive-meter ${h.fuel < 15 ? 'low' : ''}`} title="Fuel">
              <Icon name="fuel" size={16} />
              <div className="bar">
                <div style={{ width: `${h.fuel}%` }} />
              </div>
            </div>
            <div className="drive-meter damage" title="Damage">
              <Icon name="wheel" size={16} />
              <div className="bar">
                <div style={{ width: `${h.damage}%` }} />
              </div>
            </div>
            <div className="drive-stats">
              <span>
                <Icon name="people" size={15} /> {h.passengers}/14
              </span>
              <span>
                <Icon name="naira" size={15} /> {formatNaira(h.fares)}
              </span>
            </div>
          </div>
          <div className="drive-route">
            <div className="fill" style={{ width: `${h.progress * 100}%` }} />
            {h.marks.map((m, i) => (
              <span key={i} className={`mark ${m.type} ${m.done ? 'done' : ''}`} style={{ left: `${m.at * 100}%` }}>
                <Icon name={MARK_ICON[m.type]} size={12} />
              </span>
            ))}
          </div>
          {h.next[0] && (
            <div className="drive-next">
              <Icon name={MARK_ICON[h.next[0].type]} size={15} /> {h.next[0].type === 'stop' ? h.next[0].name : h.next[0].type === 'fuel' ? 'Filling station' : 'Checkpoint'} · {h.next[0].m} m
              {h.next[0].type === 'stop' && h.next[0].m < 140 && <em> · keep right and stop</em>}
            </div>
          )}
        </div>
      )}
      {h?.chase != null && (
        <div className="drive-chase">
          <Icon name="shield" size={18} /> POLICE {h.chase} m behind
        </div>
      )}
      {h?.loading && (
        <div className="drive-loading">
          <Icon name="people" size={18} /> {h.loading.name}: passengers dey enter… ({h.loading.waiting} waiting)
        </div>
      )}
      {store.toast && <div className={`drive-toast ${store.toast.kind}`}>{store.toast.text}</div>}

      {prompt?.type === 'fuel' && (
        <div className="fee-popup drive-prompt">
          <div className="speaker-name">
            <Icon name="fuel" size={18} /> Wahala Oil
          </div>
          <p>Tank {Math.round(d.fuel)}%. Attendant: "Oga, how much?"</p>
          <div className="fee-options">
            {[25, 50, 100].map((pct) => {
              const want = Math.min(pct, 100 - Math.round(d.fuel))
              if (want <= 0) return null
              return (
                <button
                  key={pct}
                  className="btn"
                  disabled={budget < fuelCost(1)}
                  onClick={() => {
                    const cost = buyFuel(d, want, budget)
                    setNote(cost ? `Paid ${formatNaira(cost)}` : 'You no get money for fuel.')
                    sfx(cost ? 'fuel' : 'wrong')
                  }}
                >
                  {pct === 100 ? 'Full' : `+${want}%`} · {formatNaira(fuelCost(want))}
                </button>
              )
            })}
          </div>
          {note && <p className="muted">{note}</p>}
          <p className="muted">Drive off when you're ready.</p>
        </div>
      )}

      {prompt?.type === 'checkpoint' && (
        <div className="fee-popup drive-prompt">
          <div className="speaker-name">
            <Icon name="shield" size={18} /> Task Force checkpoint
          </div>
          <p>"Particulars! Driver's licence! Fire extinguisher! Wetin you carry?"</p>
          <div className="fee-options column">
            <button
              className="btn"
              disabled={budget < prompt.bribe}
              onClick={() => {
                checkpointChoice(d, prompt, 'bribe')
                sfx('spend')
                useDrive.setState({ prompt: null, toast: { text: 'Barrier up. "Safe journey, my oga."', kind: 'good', at: performance.now() } })
              }}
            >
              <Icon name="naira" size={16} /> "Make we settle am" · {formatNaira(prompt.bribe)}
            </button>
            <button
              className="btn"
              onClick={() => {
                const r = checkpointChoice(d, prompt, 'talk', { goodwill })
                sfx(r.ok ? 'correct' : 'wrong')
                useDrive.setState({ toast: { text: r.ok ? 'They laugh and wave you through!' : `"You get mouth." Price don go up: ${formatNaira(prompt.bribe)}`, kind: r.ok ? 'good' : 'warn', at: performance.now() } })
                if (r.ok) useDrive.setState({ prompt: null })
              }}
            >
              <Icon name="talk" size={16} /> Talk your way through
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                checkpointChoice(d, prompt, 'flee')
                useDrive.setState({ prompt: null })
              }}
            >
              <Icon name="gas" size={16} /> Floor it!
            </button>
          </div>
        </div>
      )}

      {touch ? (
        <div className="drive-controls">
          <div className="drive-steer">
            <Hold k="left" icon="left" label="Steer left" />
            <Hold k="right" icon="right" label="Steer right" />
          </div>
          <button className="drive-btn horn" aria-label="Horn" title="Horn" onPointerDown={() => (driveInput.horn = true)}>
            <Icon name="horn" size={30} />
          </button>
          <div className="drive-pedals">
            <Hold k="brake" icon="brake" label="Brake" className="brake" />
            <Hold k="gas" icon="gas" label="Gas" className="gas" />
          </div>
        </div>
      ) : (
        <div className="keyboard-hint">W/↑ gas · S/↓ brake · A/D steer · Space horn</div>
      )}
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => d && ((d.over = 'done'), (d.fares += 3000))}>
          Finish (dev)
        </button>
      )}
    </>
  )
}
