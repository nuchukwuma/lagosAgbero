import { useState } from 'react'
import { useGameStore } from '../game/store/gameStore.js'

// Games: the games on their own, for fun (no story): the endless runner, the
// platformer, street fights, the dance battle, the danfo drive, the board and
// card games and the arcade games, at Easy, Normal or Hard. Story events
// (bluffs, exams, the fee run and so on) stay in the stories. Each game runs
// in the sandbox street, comes back here when it's done, and keeps your best
// score; practice makes each one a little harder.
import { bestScore, fightRecord } from '../game/systems/records.js'
import { bestDistance } from '../game/modes/runner/runnerStore.js'

const LEVELS = [
  ['Easy', 0.1],
  ['Normal', 0.45],
  ['Hard', 0.85],
]

// street-fight opponents for a quick fight (no story characters' big moments)
const FIGHTERS = ['kpakpa', 'scatter', 'thug', 'passenger', 'angryDriver', 'conductor', 'giggles', 'spike', 'taskForce']
const pick = (list) => list[Math.floor(Math.random() * list.length)]

const ACTION = [
  { id: 'runner', mode: 'runner', label: 'Endless Runner', blurb: 'Run from the Task Force as far as you can', params: () => ({ chaser: 'taskForce', endless: true, difficulty: 1 }), best: () => (bestDistance() ? `${bestDistance()} m` : null) },
  { id: 'escape', mode: 'escape', label: 'Rooftop Escape', blurb: 'Platformer: jump, roll, fight, get away', params: () => ({ metres: 700, difficulty: 1, to: 'the Motor Park' }) },
  { id: 'fight', mode: 'fight', label: 'Street Fight', blurb: 'A new opponent every time', params: () => ({ opponent: pick(FIGHTERS), difficulty: 1 }), best: () => (fightRecord().won ? `${fightRecord().won} won` : null) },
  { id: 'dance', mode: 'dance', label: 'Dance Battle', blurb: 'Hit the arrows on the beat', params: () => ({ name: pick(['Sweet Mother', 'DJ Jollof', 'Shaku Queen', 'Azonto Kid']), prize: 5000 }) },
  { id: 'drive', mode: 'drive', label: 'Danfo Drive', blurb: 'Load passengers, mind the fuel and the checkpoint', params: () => ({ length: 1600, stops: 3, fuel: 60, checkpoints: 1, slogan: 'NO TELLING' }) },
]
const BOARD = [
  { id: 'draughts', label: 'Draughts', blurb: 'International rules, 10×10' },
  { id: 'ayo', label: 'Ayò', blurb: 'Sow, capture twos and threes' },
  { id: 'whot', label: 'Whot!', blurb: 'Match shape or number' },
]
const ARCADE = [
  { id: 'traffic', label: 'Go-Slow' },
  { id: 'change', label: 'Exact Change' },
  { id: 'palmClimb', label: 'Palm Climb' },
  { id: 'fakeParts', label: 'Original or Fake?' },
  { id: 'akara', label: 'Akara Fry' },
  { id: 'sneak', label: 'Back Gate (stealth)' },
  { id: 'penalty', label: 'Penalty Shoot-out' },
  { id: 'posters', label: 'Poster War' },
  { id: 'ballots', label: 'Count the Votes' },
  { id: 'riceQueue', label: 'Rice Day' },
  { id: 'pepperSoup', label: 'Pepper Soup Kitchen' },
  { id: 'barRush', label: 'Bar Rush' },
]

// developers can still try the story events on their own
const STORY_EVENTS = [
  { mode: 'chase', label: 'Chase a defaulter', params: { target: 'biodun', difficulty: 1 } },
  { mode: 'feeCollection', label: 'Fee run', params: { spot: 'frontStop', duration: 60, vehicles: 8 } },
  { mode: 'conductor', label: 'Conductor (Oshodi)', params: { route: 'oshodi' } },
  { mode: 'begging', label: 'Begging run', params: { count: 6 } },
  { mode: 'rally', label: 'Rally crowd', params: { job: 'crowd' } },
  { mode: 'bluff', label: 'Bluff: live on Wahala FM', params: { scenario: 'pressFirst' } },
  { mode: 'exam', label: 'Exam: GST 101', params: { bank: 'gst101', count: 5, seconds: 16 } },
  { mode: 'haggle', label: 'Haggle: drinks', params: { goods: 'drinks', customers: 6 } },
  { mode: 'initiation', label: 'Initiation questions', params: { questions: ['knocks', 'money', 'hyena', 'form', 'boss'], seconds: 12 } },
]

function GameCard({ label, blurb, best, onPlay }) {
  return (
    <button className="btn games-btn" onClick={onPlay}>
      <strong>{label}</strong>
      {blurb && <small>{blurb}</small>}
      {best && <em className="games-best">Best: {best}</em>}
    </button>
  )
}

export default function GamesScreen({ onBack }) {
  const playGame = useGameStore((s) => s.playGame)
  const [level, setLevel] = useState(0.1)
  const dev = devToolsOn()
  const play = (mode, label, params = {}) => playGame({ mode, label, params: { ...params, level, recreational: true } })
  const arcadeBest = (id) => (bestScore(id) ? String(bestScore(id)) : null)
  return (
    <div className="screen games-screen">
      <h2>Games</h2>
      <p className="muted">Just play: no story, no saves. Every game gets a little harder the more you play it.</p>
      <div className="games-level" role="radiogroup" aria-label="Difficulty">
        <span>Difficulty</span>
        {LEVELS.map(([name, v]) => (
          <button key={name} className={`chip ${Math.abs(level - v) < 0.01 ? 'on' : ''}`} onClick={() => setLevel(v)} aria-pressed={Math.abs(level - v) < 0.01}>
            {name}
          </button>
        ))}
      </div>
      {dev && (
        <label className="games-level">
          Story point (dev) <input type="range" min="0" max="1" step="0.05" value={level} onChange={(e) => setLevel(Number(e.target.value))} /> <strong>{Math.round(level * 100)}%</strong>
        </label>
      )}
      <div className="games-groups">
        <section className="games-group">
          <h3>Action</h3>
          {ACTION.map((g) => (
            <GameCard key={g.id} label={g.label} blurb={g.blurb} best={g.best ? g.best() : arcadeBest(g.id)} onPlay={() => play(g.mode, g.label, g.params())} />
          ))}
        </section>
        <section className="games-group">
          <h3>Board &amp; card</h3>
          {BOARD.map((g) => (
            <GameCard key={g.id} label={g.label} blurb={g.blurb} best={arcadeBest(g.id)} onPlay={() => play(g.id, g.label)} />
          ))}
        </section>
        <section className="games-group">
          <h3>Arcade</h3>
          {ARCADE.map((g) => (
            <GameCard key={g.id} label={g.label} best={arcadeBest(g.id)} onPlay={() => play(g.id, g.label)} />
          ))}
        </section>
        {dev && (
          <section className="games-group">
            <h3>Story events (dev)</h3>
            {STORY_EVENTS.map((c) => (
              <GameCard key={c.label} label={c.label} onPlay={() => play(c.mode, c.label, c.params)} />
            ))}
          </section>
        )}
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
