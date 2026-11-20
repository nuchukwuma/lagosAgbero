import { useState } from 'react'
import { useGameStore } from '../game/store/gameStore.js'
import { ARCADE_GAMES, ARCADE_BY_STORY } from '../game/modes/arcade/index.js'
import campaigns from '../game/data/campaigns.json'

// Developer: play any game without the story. Every mini-game and every story
// mode, at any point of the story (the slider sets how far in you'd be, so
// you can feel the difficulty rise). Each one runs in the sandbox street and
// comes back here when it's done.

const CORE = [
  { mode: 'dance', label: 'Dance battle (rhythm)', params: { name: 'Sweet Mother', prize: 5000 } },
  { mode: 'fight', label: 'Fight: Kpakpa', params: { opponent: 'kpakpa', difficulty: 1 } },
  { mode: 'fight', label: 'Fight: Lord Laffy', params: { opponent: 'lordLaffy', difficulty: 2 } },
  { mode: 'runner', label: 'Runner: Task Force chase', params: { chaser: 'taskForce', goal: 540, difficulty: 1 } },
  { mode: 'runner', label: 'Runner: endless gauntlet', params: { chaser: 'taskForce', endless: true, difficulty: 1 } },
  { mode: 'chase', label: 'Chase a defaulter', params: { target: 'biodun', difficulty: 1, timeLimit: 30 } },
  { mode: 'feeCollection', label: 'Fee run', params: { spot: 'frontStop', duration: 60, vehicles: 8 } },
  { mode: 'conductor', label: 'Conductor (Oshodi)', params: { route: 'oshodi' } },
  { mode: 'drive', label: 'Drive the danfo', params: { length: 1600, stops: 3, fuel: 60, checkpoints: 1, slogan: 'NO TELLING' } },
  { mode: 'begging', label: 'Begging run', params: { count: 6 } },
  { mode: 'rally', label: 'Rally crowd', params: { job: 'crowd' } },
  { mode: 'bluff', label: 'Bluff: live on Wahala FM', params: { scenario: 'pressFirst' } },
  { mode: 'bluff', label: 'Bluff: the Italy man', params: { scenario: 'felixDeal' } },
  { mode: 'exam', label: 'Exam: GST 101', params: { bank: 'gst101', count: 5, seconds: 16 } },
  { mode: 'haggle', label: 'Haggle: drinks', params: { goods: 'drinks', customers: 6 } },
  { mode: 'initiation', label: 'Initiation questions', params: { questions: ['knocks', 'money', 'hyena', 'form', 'boss'], seconds: 12 } },
]

const titleOf = (g) => (typeof g.title === 'function' ? g.title({}) : g.title)

export default function GamesScreen({ onBack }) {
  const playGame = useGameStore((s) => s.playGame)
  const [level, setLevel] = useState(0.3)
  const stories = (campaigns.campaigns || campaigns).map((c) => ({ id: c.id, title: c.title }))
  const byId = Object.fromEntries(ARCADE_GAMES.map((g) => [g.id, g]))
  const play = (mode, label, params = {}) => playGame({ mode, label, params: { ...params, level } })
  return (
    <div className="screen games-screen">
      <h2>All games</h2>
      <p className="muted">Play anything without the story. The slider is how far into the story you are: games get harder as it goes.</p>
      <label className="games-level">
        Story point <input type="range" min="0" max="1" step="0.05" value={level} onChange={(e) => setLevel(Number(e.target.value))} /> <strong>{Math.round(level * 100)}%</strong>
      </label>
      <div className="games-groups">
        {stories.map((s) => (
          <section key={s.id} className="games-group">
            <h3>{s.title}</h3>
            {(ARCADE_BY_STORY[s.id] || []).map((id) => (
              <button key={id} className="btn games-btn" onClick={() => play(id, titleOf(byId[id]))}>
                {titleOf(byId[id])}
              </button>
            ))}
          </section>
        ))}
        <section className="games-group">
          <h3>Story modes</h3>
          {CORE.map((c) => (
            <button key={c.label} className="btn games-btn" onClick={() => play(c.mode, c.label, c.params)}>
              {c.label}
            </button>
          ))}
        </section>
      </div>
      <button className="btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

/** Developer tools show in dev builds, or in any build opened once with ?dev in the address. */
export function devToolsOn() {
  if (import.meta.env.DEV) return true
  try {
    if (new URLSearchParams(window.location.search).has('dev')) window.localStorage.setItem('naijavice.dev', '1')
    return window.localStorage.getItem('naijavice.dev') === '1'
  } catch {
    return false
  }
}
