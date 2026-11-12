import { useEffect, useMemo, useState } from 'react'
import { createBluff, optionsFor, answerBluff, bluffResult, ledgerFromMemory, currentQuestion } from './bluffLogic.js'
import { useGameStore } from '../../store/gameStore.js'
import characters from '../../data/characters.json'
import Icon from '../../../components/Icon.jsx'
import { sfx } from '../../audio/audio.js'

// Bluff: answer questions without breaking your story. Story params:
//   scenario  id in bluffs.json ("orientation", "dinner", "vetting"...)
//   seconds   time per question (default 9)
// Outcomes: convinced | doubted | caught | confessed

export default function BluffMode({ params, onFinish }) {
  const memory = useGameStore((s) => s.game?.memory)
  const b = useMemo(() => createBluff(params.scenario, ledgerFromMemory(memory), { seconds: params.seconds ?? 9 }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [started, setStarted] = useState(false)
  const [left, setLeft] = useState(b.seconds)
  const [note, setNote] = useState(null)
  const [, force] = useState(0)
  const asker = characters[b.scenario.asker]?.name || 'They'

  const pick = (option) => {
    const r = answerBluff(b, option)
    if (!r) return
    sfx(r.event === 'contradiction' || r.event === 'hesitated' ? 'wrong' : r.event === 'consistent' || r.event === 'truth' ? 'correct' : 'click')
    setNote({ text: r.reaction, event: r.event })
    setLeft(b.seconds)
    force((n) => n + 1)
  }

  useEffect(() => {
    if (!started || b.over) return undefined
    const id = setInterval(() => setLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [started, b.over])
  useEffect(() => {
    if (started && !b.over && left <= 0) pick(null)
  }, [left]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!started)
    return (
      <div className="fee-intro bluff">
        <h2>
          <Icon name="talk" size={26} /> {b.scenario.title}
        </h2>
        <p>{b.scenario.intro}</p>
        <ul>
          <li>Answer before the time runs out. Hesitating looks bad.</li>
          <li>Whatever you claim is remembered, for the rest of the story. Change your story later and people notice.</li>
          <li>You can always tell the truth. Some truths change everything.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => setStarted(true)}>
          Face them
        </button>
      </div>
    )

  if (b.over) {
    const titles = { convinced: 'They believe you. For now.', doubted: 'They let it go. They will not forget.', caught: 'Caught.', confessed: 'You told the truth.' }
    return (
      <div className="fee-intro bluff">
        <h2>{titles[b.over]}</h2>
        <div className="bluff-meter">
          <span>Suspicion</span>
          <div className="bar">
            <div style={{ width: `${b.suspicion}%` }} />
          </div>
        </div>
        {Object.keys(b.claims).length > 0 && <p className="muted">Your story now: {Object.values(b.claims).length} thing(s) people believe about you.</p>}
        <button className="btn btn-primary" onClick={() => onFinish(bluffResult(b))}>
          Continue
        </button>
      </div>
    )
  }

  const q = currentQuestion(b)
  return (
    <div className="fee-popup bluff">
      <div className="fee-row">
        <span className="speaker-name">{asker}</span>
        <span className={left <= 3 ? 'warn' : 'muted'}>{left}s</span>
      </div>
      <div className="bluff-meter">
        <span>Suspicion</span>
        <div className="bar">
          <div style={{ width: `${b.suspicion}%` }} />
        </div>
      </div>
      {note && <p className={`bluff-note ${note.event}`}>{note.text}</p>}
      <p>
        <strong>{q.q}</strong>
      </p>
      <div className="fee-options column">
        {optionsFor(b).map((o) => (
          <button key={o.index} className={`btn ${o.stick ? 'btn-primary' : ''}`} onClick={() => pick(o)}>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}
