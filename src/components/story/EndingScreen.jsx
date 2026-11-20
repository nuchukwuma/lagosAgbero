import { useEffect, useMemo, useState } from 'react'
import { recordEnding, endingsFound } from '../../game/store/saveSystem.js'
import { useGameStore } from '../../game/store/gameStore.js'
import { storyCtx } from '../../game/narrative/storyData.js'
import { rateRun, rateStory, storyRating } from '../../game/systems/rating.js'
import Icon from '../Icon.jsx'

// Shown when the story reaches an ending. Only endings finish the game.
// After the epilogue: the game's verdict on the run (a grade and a comment,
// a roast for the short roads), the player's own star rating of the story,
// and a push to find another ending or try another story.
export default function EndingScreen({ view, onTitle, onLoad, onMap }) {
  const game = useGameStore((s) => s.game)
  const goTo = useGameStore((s) => s.goTo)
  useEffect(() => recordEnding(view.id), [view.id])
  const verdict = useMemo(() => rateRun(view, game, storyCtx, endingsFound()), [view, game])
  const campaign = game?.campaign || 'areaBoy'
  const [stars, setStars] = useState(() => storyRating(campaign)?.stars || 0)
  const [thanks, setThanks] = useState(false)
  const delay = (i) => ({ animationDelay: `${i * 0.9}s` })
  const after = view.epilogue.length + (view.fates?.length ? 1 : 0)
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
      <div className={`ending-verdict tier-${verdict.tier}`} style={delay(after)}>
        <div className="verdict-grade" aria-label={`Grade ${verdict.grade}`}>
          {verdict.grade}
        </div>
        <div>
          <h3>How you played it</h3>
          <p>{verdict.comment}</p>
          <p className="muted">
            {verdict.chapters} of {verdict.totalChapters} chapters · bonds {verdict.bonds}/100 · {verdict.endingsTotal - verdict.endingsLeft} of {verdict.endingsTotal} endings found
          </p>
          <p className="verdict-nudge">{verdict.nudge}</p>
        </div>
      </div>
      <div className="ending-rate" style={delay(after + 1)}>
        <h3>How was this story?</h3>
        <div className="stars" role="radiogroup" aria-label="Rate this story">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star ${n <= stars ? 'on' : ''}`}
              role="radio"
              aria-checked={n === stars}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => {
                setStars(n)
                rateStory(campaign, n, view.id)
                setThanks(true)
              }}
            >
              ★
            </button>
          ))}
        </div>
        {thanks && <p className="muted">{stars >= 4 ? 'E go better for you! Thank you.' : stars >= 3 ? 'Thank you. We go do better.' : 'Thank you for telling us. We dey listen.'}</p>}
      </div>
      <div className="menu">
        {onMap && (
          <button className="btn" onClick={onMap}>
            <Icon name="dodge" size={18} /> See the road you took
          </button>
        )}
        <button className="btn" onClick={onLoad}>
          Load a save: find another ending
        </button>
        <button className="btn" onClick={() => goTo('newGame')}>
          Try a different story
        </button>
        <button className="btn btn-primary" onClick={onTitle}>
          Back to title
        </button>
      </div>
    </div>
  )
}
