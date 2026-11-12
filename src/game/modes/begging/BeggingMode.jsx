import { useMemo, useState } from 'react'
import { createBegRun, approach, currentTarget, begResult, BEG } from './beggingLogic.js'
import { formatNaira } from '../../narrative/stats.js'

// Aggressive begging at the Zone 5 Estate gate. Story params:
//   count        how many people pass (default 6)
//   wrongPerson  "nephew" | "bassey" — one of them is the wrong person
//   wrongAt      which one (index)
//   seed
// Outcomes: done | wrongPerson | chased

const REACTIONS = {
  great: ['"Ehen! This one sabi talk. Take!"', 'A fat roll of naira lands in your hand.', '"God bless you too, my son." Bundle!'],
  some: ['A few notes through the window.', '"Take this one and go."', 'Small money. Better than nothing.'],
  nothing: ['The window goes up. Nothing.', '"Go and look for work!"', 'He looks through you like glass.'],
  skipped: ['You let them pass.'],
  dodged: ['You let him pass. Something about him smelled like wahala.'],
}
const pick = (a) => a[Math.floor(Math.random() * a.length)]

export default function BeggingMode({ params, onFinish }) {
  const run = useMemo(() => createBegRun({ seed: params.seed ?? Math.floor(Math.random() * 999), count: params.count ?? 6, wrongPerson: params.wrongPerson ?? null, wrongAt: params.wrongAt ?? 3, goodwill: params.goodwill ?? 10 }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [started, setStarted] = useState(false)
  const [note, setNote] = useState(null)
  const [, force] = useState(0)
  const t = currentTarget(run)

  if (!started)
    return (
      <div className="fee-intro">
        <h2>Zone 5 gate</h2>
        <p>Rich people pass this gate all day. Read each one, then beg the way they like to be begged.</p>
        <ul>
          <li>Ogas love praise. Madams and pastors love a sad story. Big boys love a show.</li>
          <li>Standing in front of cars pays sometimes, but the estate will remember.</li>
          <li>Some people you should never beg. Read the signs.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => setStarted(true)}>
          Oya, start
        </button>
      </div>
    )

  if (run.over) {
    const res = begResult(run)
    return (
      <div className="fee-intro">
        <h2>{run.over === 'wrongPerson' ? 'Wrong person.' : run.over === 'chased' ? 'Security don pursue you!' : 'Gate closes for the day'}</h2>
        {run.over === 'wrongPerson' ? <p>That was {BEG.wrong[run.targets[run.index].kind]?.who}. Your stomach drops.</p> : <p>You collected {formatNaira(run.collected)}{run.over === 'chased' ? ', and dropped half of it running.' : '.'}</p>}
        <p className="muted">Estate anger {Math.round(run.anger)}</p>
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
          <strong>BEGGING · Zone 5</strong>
          <span>
            {run.index + 1}/{run.targets.length}
          </span>
        </div>
        <div className="fee-row">
          <span>Collected {formatNaira(run.collected)}</span>
          <span className={run.anger > 60 ? 'warn' : 'muted'}>Estate anger {Math.round(run.anger)}</span>
        </div>
        <div className="fee-quota">
          <div style={{ width: `${run.anger}%`, background: run.anger > 60 ? '#e2553a' : '#f39c12' }} />
        </div>
        {note && <div className="fee-log">{note}</div>}
      </div>
      <div className="fee-popup">
        <div className="speaker-name">{t.wrong ? t.name : '???'}</div>
        <p>{t.hint}</p>
        <div className="fee-options column">
          {Object.entries(BEG.approaches).map(([id, a]) => (
            <button
              key={id}
              className="btn"
              onClick={() => {
                const r = approach(run, id)
                if (r.outcome !== 'wrongPerson') setNote(`${pick(REACTIONS[r.outcome] || REACTIONS.nothing)}${r.gain ? ` +${formatNaira(r.gain)}` : ''}`)
                force((n) => n + 1)
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
