import { useMemo, useState } from 'react'
import { createRally, playRound, rallyResult, canUse, RALLY } from './rallyLogic.js'
import { formatNaira } from '../../narrative/stats.js'

// Settlement's rally job at the Roundabout. Story params:
//   job   "disturb" (scatter the PJP rally) | "crowd" (fill the FEP rally)
//   help  extra disruption per round from friends (e.g. Scatter's boys)
//   seed
// Outcomes: paid | faked | failed | arrested | brawl

export default function RallyMode({ params, onFinish }) {
  const rally = useMemo(() => createRally({ job: params.job, seed: params.seed ?? Math.floor(Math.random() * 999), help: params.help ?? 0 }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [started, setStarted] = useState(false)
  const [note, setNote] = useState(null)
  const [, force] = useState(0)
  const j = rally.job

  if (!started)
    return (
      <div className="fee-intro">
        <h2>{j.title}</h2>
        <p>
          Settlement pays {formatNaira(j.pay)} if the rally "feels" it. Six rounds. Get the noise meter to {j.goal}, keep the heat under 100.
        </p>
        <ul>
          <li>Loud moves get noticed by cameras and police.</li>
          <li>You can fake it and film yourself. Settlement pays half and remembers.</li>
          <li>Touching their speakers can start a fight.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => setStarted(true)}>
          Enter the crowd
        </button>
      </div>
    )

  if (rally.over) {
    const res = rallyResult(rally)
    const titles = { paid: 'Job done. Settlement smiles.', faked: 'You "did" the job.', failed: 'The rally no even notice you.', arrested: 'Police van!', brawl: 'Their thugs don hold you!' }
    return (
      <div className="fee-intro">
        <h2>{titles[rally.over]}</h2>
        <p>
          Noise {Math.round(rally.disruption)}/{j.goal} · Heat {Math.round(rally.heat)} · Pay {formatNaira(res.moneyChange)}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(res)}>
          Continue
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="fee-hud">
        <div className="fee-row">
          <strong>RALLY · {j.title}</strong>
          <span>
            Round {rally.round + 1}/{j.rounds}
          </span>
        </div>
        <div className="fee-row">
          <span>Noise {Math.round(rally.disruption)}/{j.goal}</span>
          <span className={rally.heat > 60 ? 'warn' : 'muted'}>Heat {Math.round(rally.heat)}</span>
        </div>
        <div className="fee-quota">
          <div style={{ width: `${Math.min(100, (rally.disruption / j.goal) * 100)}%` }} />
        </div>
        <div className="fee-quota">
          <div style={{ width: `${rally.heat}%`, background: '#e2553a' }} />
        </div>
        {note && <div className="fee-log">{note}</div>}
      </div>
      <div className="fee-popup">
        <div className="speaker-name">The Roundabout</div>
        <p>"FORWARD EVER!" "BACKWARD SOMETIMES!" The crowd sways. What do you do?</p>
        <div className="fee-options column">
          {Object.entries(RALLY.actions).map(([id, a]) => (
            <button
              key={id}
              className="btn"
              disabled={!canUse(rally, id)}
              onClick={() => {
                const r = playRound(rally, id)
                setNote(r.event)
                force((n) => n + 1)
              }}
            >
              {a.label}
              {a.uses === 'rice' ? ` (${rally.rice} left)` : ''}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
