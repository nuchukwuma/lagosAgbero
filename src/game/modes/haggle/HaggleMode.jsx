import { useMemo, useState } from 'react'
import { createHaggle, ask, acceptCounter, current, haggleResult, GOODS } from './haggleLogic.js'
import { formatNaira } from '../../narrative/stats.js'
import { sfx } from '../../audio/audio.js'
import { seenIntro, markIntroSeen } from '../../systems/records.js'

// Selling at a stall: yams at Nkwọ market, palm wine, lecture notes... One
// customer at a time: read the hint, name your price, take their counter or
// push your luck. Story params:
//   goods      "yams" | "palmwine" | "notes" | "jollof"
//   customers  how many come (default 6)
// Outcomes: good | ok | bad (the takings are paid either way)

const SOLD = ['"Deal. Wrap am."', 'Money changes hands. Smiles all round.', '"Ehen! Na so." They pay.']
const COUNTER = ['"Ah-ah! Reduce am small."', '"Which kain price be that? I go give you…"', '"Customer no be enemy o. Take…"']
const WALKED = ['They kiss their teeth and walk to the next stall.', '"God punish expensive." Gone.', 'They walk off without looking back.']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

export default function HaggleMode({ params, onFinish }) {
  const h = useMemo(() => createHaggle({ goods: params.goods, customers: params.customers ?? 6, seed: params.seed ?? Math.floor(Math.random() * 999) }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const g = h.goods
  const [started, setStarted] = useState(false)
  const [price, setPrice] = useState(g.fair)
  const [note, setNote] = useState(null)
  const [, force] = useState(0)
  const c = current(h)
  const firstTime = !seenIntro('haggle')

  const act = (r) => {
    if (!r) return
    if (r.result === 'sold') {
      sfx('coin')
      setNote(`${pick(SOLD)} +${formatNaira(r.price)}`)
      setPrice(g.fair)
    } else if (r.result === 'counter') setNote(`${pick(COUNTER)} ${formatNaira(r.price)}?`)
    else {
      sfx('bump')
      setNote(pick(WALKED))
      setPrice(g.fair)
    }
    force((n) => n + 1)
  }

  if (!started)
    return (
      <div className="fee-intro">
        <h2>Selling {g.name}</h2>
        {firstTime ? (
          <ul>
            <li>One customer at a time. Read them: a car and gold means they can pay more; counting coins means they can't.</li>
            <li>Name your price. Too high and they counter: take it, or push and risk them walking.</li>
            <li>A fair {g.unit} goes for about {formatNaira(g.fair)}.</li>
          </ul>
        ) : (
          <p>A fair {g.unit} goes for about {formatNaira(g.fair)}. {params.customers ?? 6} customers today.</p>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            markIntroSeen('haggle')
            setStarted(true)
          }}
        >
          Open the stall
        </button>
      </div>
    )

  if (h.over) {
    const res = haggleResult(h)
    return (
      <div className="fee-intro">
        <h2>{res.outcome === 'good' ? 'Good day at the stall!' : res.outcome === 'ok' ? 'Not bad.' : 'Nobody bought.'}</h2>
        <p>
          Sold {res.sold} · walked away {res.walked} · takings <strong>{formatNaira(res.moneyChange)}</strong>
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(res)}>
          Close the stall
        </button>
      </div>
    )
  }

  const steps = [0.7, 0.9, 1, 1.15, 1.3, 1.6].map((k) => Math.round((g.fair * k) / 50) * 50)
  return (
    <div className="fee-intro haggle">
      <h2>
        Customer {h.index + 1} of {h.queue.length}
      </h2>
      <p className="haggle-hint">This one {c.hint}.</p>
      {note && <p className="haggle-note">{note}</p>}
      <div className="haggle-price">
        <button className="btn btn-small" onClick={() => setPrice((p) => Math.max(100, p - 100))} aria-label="Lower">
          −
        </button>
        <strong>{formatNaira(price)}</strong>
        <button className="btn btn-small" onClick={() => setPrice((p) => p + 100)} aria-label="Higher">
          +
        </button>
      </div>
      <div className="haggle-steps">
        {steps.map((s) => (
          <button key={s} className={`chip ${s === price ? 'on' : ''}`} onClick={() => setPrice(s)}>
            {formatNaira(s)}
          </button>
        ))}
      </div>
      <div className="result-actions">
        <button className="btn btn-primary" onClick={() => act(ask(h, price))}>
          "Na {formatNaira(price)}."
        </button>
        {c.counter && (
          <button className="btn" onClick={() => act(acceptCounter(h))}>
            Take their {formatNaira(c.counter)}
          </button>
        )}
      </div>
      <p className="muted">
        Takings so far {formatNaira(h.takings)} · a fair {g.unit} is about {formatNaira(GOODS[params.goods]?.fair || g.fair)}
      </p>
    </div>
  )
}
