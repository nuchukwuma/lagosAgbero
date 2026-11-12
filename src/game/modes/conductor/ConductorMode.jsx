import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import routesData from '../../data/routes.json'
import { createTrip, dropOff, callRoute, paymentFor, changeOptions, settleFare, settleQuirk, nextStop, conductorPay, isLastStop, stopName } from './conductorLogic.js'
import { formatNaira } from '../../narrative/stats.js'
import { sfx } from '../../audio/audio.js'

// Bus conductor mission. Story params (startMode "conductor"):
//   route        "oshodi"
//   named        named passengers: ["kelvin", "prophet", "mamaPepper"]
//   extortionAt  stop index where Scatter's boys block the bus (e.g. 1)
//   extortion    ₦ they demand (default 2000)
//   driver       driver id (for the slogan / lines)
//   seed
// Outcomes: done | brawl | extorted (refused Scatter's boys -> the story starts a fight)

// tiny store the 3D director reads: is the bus driving or stopped?
export const useBus = create((set) => ({ active: false, phase: 'idle', stop: 0, setPhase: (phase, stop) => set({ phase, stop }) }))

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)]

export default function ConductorMode({ params, onFinish }) {
  const trip = useMemo(() => createTrip({ route: params.route, seed: params.seed ?? Math.floor(Math.random() * 999), named: params.named || [], extortionAt: params.extortionAt ?? null }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState('intro') // intro | driving | dropoff | extortion | call | fares | summary
  const [selected, setSelected] = useState(new Set())
  const [boarding, setBoarding] = useState([])
  const [fareIdx, setFareIdx] = useState(0)
  const [note, setNote] = useState(null)
  const [, force] = useState(0)
  const outcome = useRef(null)
  const extortionDone = useRef(false)
  const refresh = () => force((n) => n + 1)
  const stop = stopName(trip)
  const lines = routesData.lines

  useEffect(() => {
    useBus.setState({ active: true, phase: 'idle', stop: 0 })
    return () => useBus.setState({ active: false, phase: 'idle' })
  }, [])

  // driving between stops
  useEffect(() => {
    if (step !== 'driving') return undefined
    useBus.getState().setPhase('driving', trip.stopIndex)
    sfx('hornLong')
    const id = setTimeout(() => {
      useBus.getState().setPhase('stopped', trip.stopIndex)
      arrive()
    }, 3500)
    return () => clearTimeout(id)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function arrive() {
    if (trip.passengers.length) setStep('dropoff')
    else afterDrop()
  }
  function afterDrop() {
    if (trip.extortionAt === trip.stopIndex && !extortionDone.current) return setStep('extortion')
    if (isLastStop(trip)) return finishTrip()
    setStep('call')
  }
  function finishTrip(forced) {
    outcome.current = forced || trip.over || 'done'
    useBus.getState().setPhase('stopped', trip.stopIndex)
    setStep('summary')
  }
  function leave() {
    const r = nextStop(trip)
    if (r === 'brawl') return finishTrip('brawl')
    setStep('driving')
  }

  const calls = useMemo(() => [trip.route.call, ...trip.route.wrongCalls].sort(() => Math.random() - 0.5), [trip.stopIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = boarding[fareIdx]
  const given = useMemo(() => (current ? paymentFor(trip, current) : 0), [current]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = useMemo(() => (current ? changeOptions(trip, given) : []), [current, given]) // eslint-disable-line react-hooks/exhaustive-deps

  function nextFare() {
    if (fareIdx + 1 < boarding.length) setFareIdx(fareIdx + 1)
    else {
      setBoarding([])
      setFareIdx(0)
      leave()
    }
  }

  const header = (
    <div className="fee-hud">
      <div className="fee-row">
        <strong>CONDUCTOR · {trip.route.name}</strong>
        <span>
          Stop {trip.stopIndex + 1}/{trip.route.stops.length}
        </span>
      </div>
      <div className="fee-row">
        <span>Fares {formatNaira(trip.fares)}</span>
        <span className={trip.anger > 60 ? 'warn' : 'muted'}>Bus anger {Math.round(trip.anger)}</span>
      </div>
      <div className="fee-quota">
        <div style={{ width: `${trip.anger}%`, background: trip.anger > 60 ? '#e2553a' : '#f39c12' }} />
      </div>
      {note && <div className="fee-log">{note}</div>}
    </div>
  )

  if (step === 'intro')
    return (
      <div className="fee-intro">
        <h2>Conductor work</h2>
        <p>
          Route: <strong>{trip.route.stops.join(' → ')}</strong>. Fare {formatNaira(trip.route.fare)}.
        </p>
        <ul>
          <li>Shout the correct route so the correct people enter.</li>
          <li>Give correct change. Short change = wahala.</li>
          <li>Remember where each passenger dey go. Forget = more wahala.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => setStep('call')}>
          Oya, hang for door!
        </button>
      </div>
    )

  if (step === 'summary') {
    const pay = Math.max(0, conductorPay(trip))
    const res = {
      outcome: outcome.current,
      moneyChange: outcome.current === 'brawl' ? Math.round(pay / 2) : pay,
      stats: { communityGoodwill: trip.anger < 30 ? 2 : trip.anger > 70 ? -3 : 0, energy: -8 },
      flags: [outcome.current === 'done' ? 'conductorDone' : `conductor_${outcome.current}`],
    }
    return (
      <div className="fee-intro">
        <h2>{outcome.current === 'brawl' ? 'Wahala for bus!' : outcome.current === 'extorted' ? 'Scatter boys block the road' : 'Last stop!'}</h2>
        <p>
          Fares collected {formatNaira(trip.fares)} · your 30% + tips {formatNaira(res.moneyChange)}
        </p>
        <p className="muted">Final bus anger {Math.round(trip.anger)}</p>
        <button className="btn btn-primary" onClick={() => onFinish(res)}>
          Continue
        </button>
      </div>
    )
  }

  return (
    <>
      {header}
      {step === 'driving' && <div className="fee-popup">On the way to <strong>{trip.route.stops[trip.stopIndex + 1]}</strong>… hold the door!</div>}

      {step === 'dropoff' && (
        <div className="fee-popup">
          <div className="speaker-name">{stop}</div>
          <p>Who dey come down for {stop}? (tap the passengers)</p>
          <div className="chip-row">
            {trip.passengers.map((p) => (
              <button
                key={p.id}
                className={`chip ${selected.has(p.id) ? 'on' : ''}`}
                onClick={() => {
                  const s = new Set(selected)
                  s.has(p.id) ? s.delete(p.id) : s.add(p.id)
                  setSelected(s)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              const r = dropOff(trip, [...selected])
              setSelected(new Set())
              setNote(r.missed ? pick(lines.angryMissed) : r.wrong ? pick(lines.angryWrongDrop) : r.correct ? pick(lines.happy) : null)
              refresh()
              afterDrop()
            }}
          >
            Done
          </button>
        </div>
      )}

      {step === 'extortion' && (
        <div className="fee-popup">
          <div className="speaker-name">Scatter's boys</div>
          <p>"Under-Bridge na our territory. {formatNaira(params.extortion ?? 2000)} for the road. Now now."</p>
          <div className="fee-options">
            <button
              className="btn"
              onClick={() => {
                extortionDone.current = true
                trip.fares = Math.max(0, trip.fares - (params.extortion ?? 2000))
                setNote('You paid. The boys laugh as the bus moves.')
                isLastStop(trip) ? finishTrip() : setStep('call')
              }}
            >
              Pay from the fares
            </button>
            <button
              className="btn"
              onClick={() => {
                extortionDone.current = true
                trip.anger = Math.min(100, trip.anger + 10)
                setNote('The driver pays them and curses you all the way.')
                isLastStop(trip) ? finishTrip() : setStep('call')
              }}
            >
              Let the driver pay
            </button>
            <button className="btn btn-primary" onClick={() => finishTrip('extorted')}>
              "Una no go collect anything!"
            </button>
          </div>
        </div>
      )}

      {step === 'call' && (
        <div className="fee-popup">
          <div className="speaker-name">{stop}</div>
          <p>Passengers dey wait. Shout your route!</p>
          <div className="fee-options column">
            {calls.map((c) => (
              <button
                key={c}
                className="btn"
                onClick={() => {
                  const b = callRoute(trip, c === trip.route.call)
                  sfx(c === trip.route.call ? 'horn' : 'wrong')
                  setBoarding(b)
                  setFareIdx(0)
                  setNote(b.map((p) => `${p.name} → ${trip.route.stops[p.dest]}`).join(' · '))
                  refresh()
                  b.length ? setStep('fares') : leave()
                }}
              >
                "{c}"
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'fares' && current && (
        <div className="fee-popup">
          <div className="speaker-name">
            {current.name} → {trip.route.stops[current.dest]}
          </div>
          {current.quirk === 'transfer' || current.quirk === 'prophecy' ? (
            <>
              <p>"{current.line}"</p>
              <div className="fee-options">
                <button className="btn" onClick={() => { const r = settleQuirk(trip, current, true); setNote(r.outcome === 'transferNeverCame' ? 'The transfer never came. Kelvin don waka.' : r.outcome === 'prophecy' ? 'You receive a prophecy: "You go hammer." No naira.' : 'Alert! The transfer actually came.'); refresh(); nextFare() }}>
                  {current.quirk === 'transfer' ? 'Accept "transfer"' : 'Accept the prophecy'}
                </button>
                <button className="btn" onClick={() => { const r = settleQuirk(trip, current, false); setNote(r.outcome === 'prophetPaid' ? 'The Prophet pays, muttering about your future.' : 'Kelvin argues all the way.'); refresh(); nextFare() }}>
                  "Cash. Now."
                </button>
              </div>
            </>
          ) : current.quirk === 'wrongBus' ? (
            <>
              <p>"Wait... this bus no dey go Lekki?! Conductor, you lie!"</p>
              <button className="btn" onClick={() => { settleFare(trip, current, 0, 0); setNote('Wrong passenger. Bus anger rises.'); refresh(); nextFare() }}>
                "Sorry o..."
              </button>
            </>
          ) : (
            <>
              <p>
                Gives you <strong>{formatNaira(given)}</strong> for the {formatNaira(trip.route.fare)} fare. Change?
              </p>
              <div className="fee-options">
                {options.map((c) => (
                  <button
                    key={c}
                    className="btn"
                    onClick={() => {
                      const r = settleFare(trip, current, given, c)
                      sfx(r.outcome === 'ok' ? 'coin' : 'wrong')
                      setNote(r.outcome === 'ok' ? pick(lines.happy) : r.outcome === 'short' ? pick(lines.angryShort) : r.outcome === 'refused' ? pick(lines.refuse) : 'You gave too much change. Your loss.')
                      refresh()
                      nextFare()
                    }}
                  >
                    {formatNaira(c)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
