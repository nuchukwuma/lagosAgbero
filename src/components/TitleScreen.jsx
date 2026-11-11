import { latestSave } from '../game/store/saveSystem.js'

export default function TitleScreen({ onNavigate, onContinue }) {
  const hasSave = Boolean(latestSave())
  return (
    <div className="screen title-screen">
      <div className="title-block">
        <h1>AREA BOY</h1>
        <p className="tagline">Owo da? Na street go teach you.</p>
      </div>
      <div className="menu">
        {hasSave && (
          <button className="btn btn-primary" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className={`btn ${hasSave ? '' : 'btn-primary'}`} onClick={() => onNavigate('newGame')}>
          New Game
        </button>
        {hasSave && (
          <button className="btn" onClick={() => onNavigate('load')}>
            Load
          </button>
        )}
        <button className="btn" onClick={() => onNavigate('about')}>
          About
        </button>
        <button className="btn btn-small" onClick={() => onNavigate('assets')}>
          Asset Check (dev)
        </button>
      </div>
      <p className="footnote">Phase 1 build · story engine test</p>
    </div>
  )
}
