import { useEffect } from 'react'
import { recordEnding } from '../../game/store/saveSystem.js'

// Shown when the story reaches an ending. Only endings finish the game.
export default function EndingScreen({ view, onTitle, onLoad }) {
  useEffect(() => recordEnding(view.id), [view.id])
  const delay = (i) => ({ animationDelay: `${i * 0.9}s` })
  return (
    <div className="ending-screen">
      <div className="ending-label">{view.secret ? 'SECRET ENDING' : 'ENDING'}</div>
      <h1>{view.title}</h1>
      <div className="ending-epilogue">
        {view.epilogue.map((line, i) => (
          <p key={i} style={delay(i)}>
            {line}
          </p>
        ))}
      </div>
      {view.fates?.length > 0 && (
        <div className="ending-fates" style={delay(view.epilogue.length)}>
          <h3>What became of them</h3>
          <ul>
            {view.fates.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="menu">
        <button className="btn" onClick={onLoad}>
          Load a save
        </button>
        <button className="btn btn-primary" onClick={onTitle}>
          Back to title
        </button>
      </div>
    </div>
  )
}
