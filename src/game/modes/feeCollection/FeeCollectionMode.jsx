import { useEffect, useState } from 'react'
import { useFeeRun } from './feeRunStore.js'
import { traffic, releaseVehicle } from '../../systems/traffic.js'
import { feeFor } from '../../systems/fees.js'
import { styleOf, feeBonus } from '../../systems/wardrobe.js'
import { useGameStore } from '../../store/gameStore.js'
import MoveControls from '../../../components/hud/MoveControls.jsx'
import { input } from '../../player/input.js'
import { formatNaira } from '../../narrative/stats.js'

// The fee run, played in the 3D street. Vehicles pull in at the stop; walk up
// to one and COLLECT. Drivers pay, haggle or refuse depending on your fee.
// Ends when time runs out, or early if the story's defaulter runs off.

function Intro({ store, onStart }) {
  const fee = store.stopFee
  return (
    <div className="fee-intro">
      <h2>Fee run · {store.stopLabel}</h2>
      <p>Vehicles go stop for your side. Walk to each one and press <strong>COLLECT</strong>.</p>
      <ul>
        <li>Danfo {formatNaira(feeFor('danfo', fee))} · Taxi {formatNaira(feeFor('taxi', fee))}</li>
        <li>Keke {formatNaira(feeFor('keke', fee))} · Okada {formatNaira(feeFor('okada', fee))} · Lorry {formatNaira(feeFor('lorry', fee))}</li>
      </ul>
      <p className="muted">Baba Ticket's share today: {formatNaira(store.quota)}. If a vehicle waits too long, e go drive off without paying.</p>
      <button className="btn btn-primary" onClick={onStart}>
        Oya, start
      </button>
    </div>
  )
}

function Summary({ store, result, onDone }) {
  return (
    <div className="fee-intro">
      <h2>{result.outcome === 'defaulter' ? 'E don run!' : 'Time up'}</h2>
      <p>
        You collected <strong>{formatNaira(store.collected)}</strong> of Baba Ticket's {formatNaira(store.quota)}.
      </p>
      <p className="muted">
        Paid: {(store.counts.paidFair || 0) + (store.counts.paidOver || 0) + (store.counts.acceptedLess || 0)} · Let go: {store.counts.letGo || 0} · Threatened: {store.counts.threatened || 0} · Missed: {store.counts.missed || 0}
      </p>
      <button className="btn btn-primary" onClick={onDone}>
        Continue
      </button>
    </div>
  )
}

export default function FeeCollectionMode({ params, onFinish }) {
  const store = useFeeRun()
  const stats = useGameStore((s) => s.game?.stats)
  const look = useGameStore((s) => s.game?.player?.look)
  const [result, setResult] = useState(null)

  useEffect(() => {
    useFeeRun.getState().start({ ...params, fairFeeBonus: feeBonus(styleOf(look)) }, stats || {})
    return () => {
      input.runButton = false
      useFeeRun.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // when the run ends, waiting vehicles drive off and we freeze the result
  useEffect(() => {
    if (!store.ended || result) return
    for (const v of traffic.vehicles) if (v.tag.feeRun && !v.tag.done) releaseVehicle(v)
    setResult(useFeeRun.getState().result())
  }, [store.ended, result])

  const nearVehicle = store.near ? traffic.vehicles.find((v) => v.id === store.near) : null
  const nearFee = nearVehicle ? feeFor(nearVehicle.kind, store.stopFee) : 0

  // keyboard: E / Enter collect, 1–2 popup options
  useEffect(() => {
    const onKey = (e) => {
      const s = useFeeRun.getState()
      if (s.popup?.options.length) {
        const n = Number(e.key)
        if (n >= 1 && n <= s.popup.options.length) s.choose(s.popup.options[n - 1])
      } else if ((e.code === 'KeyE' || e.key === 'Enter') && s.near && s.started) s.collect(s.near)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!store.active) return null
  if (!store.started) return <Intro store={store} onStart={store.begin} />
  if (store.ended && result) return <Summary store={store} result={result} onDone={() => onFinish(result)} />

  const quotaPct = Math.min(100, (store.collected / Math.max(1, store.quota)) * 100)
  return (
    <>
      <div className="fee-hud">
        <div className="fee-row">
          <strong>FEE RUN · {store.stopLabel}</strong>
          <span>⏱ {Math.ceil(store.timeLeft)}s</span>
        </div>
        <div className="fee-timer">
          <div style={{ width: `${(store.timeLeft / store.duration) * 100}%` }} />
        </div>
        <div className="fee-row">
          <span>Collected {formatNaira(store.collected)}</span>
          <span className="muted">Baba Ticket {formatNaira(store.quota)}</span>
        </div>
        <div className="fee-quota">
          <div style={{ width: `${quotaPct}%` }} />
        </div>
        <div className="fee-log">
          {store.log.map((l) => (
            <div key={l.id} className={l.amount ? 'good' : 'bad'}>
              {l.text}
            </div>
          ))}
        </div>
      </div>

      {store.popup && (
        <div className="fee-popup">
          <div className="speaker-name">{store.popup.name}</div>
          <p>{store.popup.line}</p>
          {store.popup.options.length > 0 && (
            <div className="fee-options">
              {store.popup.options.map((o, i) => (
                <button key={o.action} className="btn" onClick={() => store.choose(o)}>
                  <span className="choice-num">{i + 1}</span> {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <MoveControls actionLabel={nearVehicle && !store.popup ? 'COLLECT' : null} actionSub={nearVehicle ? formatNaira(nearFee) : null} onAction={() => nearVehicle && store.collect(nearVehicle.id)} />
      {import.meta.env.DEV && (
        <button className="btn btn-small dev-end" onClick={() => store.end('done')}>
          End run (dev)
        </button>
      )}
    </>
  )
}
