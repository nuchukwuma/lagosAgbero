import { useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import StoryBackground from './StoryBackground.jsx'
import TopBar from './TopBar.jsx'
import DialogueBox from './DialogueBox.jsx'
import ChoiceMenu from './ChoiceMenu.jsx'
import NewsBroadcast from './NewsBroadcast.jsx'
import CutsceneCards from './CutsceneCards.jsx'
import ChapterEndCard from './ChapterEndCard.jsx'
import EndingScreen from './EndingScreen.jsx'
import StatusPanel from './StatusPanel.jsx'
import GameMenu from './GameMenu.jsx'
import Toasts from './Toasts.jsx'
import ModeHost from './ModeHost.jsx'

// The story screen: background + mini HUD + whatever the engine says to show.
export default function StoryScreen() {
  const { game, view, toasts, error, advance, choose, save, load, quitToTitle, dismissToast, goTo } = useGameStore()
  const [overlay, setOverlay] = useState(null) // 'status' | 'menu' | null

  if (!game || !view) return null

  if (view.type === 'ending') {
    return <EndingScreen view={view} onTitle={quitToTitle} onLoad={() => goTo('load')} />
  }

  const raining = Boolean(game.flags.raining)
  let content = null
  switch (view.type) {
    case 'dialogue':
      content = <DialogueBox view={view} onNext={advance} />
      break
    case 'choice':
      content = <ChoiceMenu view={view} onChoose={choose} />
      break
    case 'news':
      content = <NewsBroadcast view={view} onNext={advance} />
      break
    case 'cutscene':
      content = <CutsceneCards view={view} onDone={advance} />
      break
    case 'chapterEnd':
      content = <ChapterEndCard view={view} onNext={advance} />
      break
    case 'mode':
      content = <ModeHost key={view.key} view={view} />
      break
    case 'finished':
      content = (
        <div className="cutscene">
          <div className="cutscene-card">
            <h2>To be continued…</h2>
            <p>That's all the story written so far.</p>
            <button className="btn btn-primary" onClick={quitToTitle}>
              Back to title
            </button>
          </div>
        </div>
      )
      break
    default:
      content = null
  }

  return (
    <div className="story-screen">
      <StoryBackground name={view.background} />
      {raining && <div className="rain" aria-hidden="true" />}
      <TopBar game={game} onStatus={() => setOverlay('status')} onMenu={() => setOverlay('menu')} />
      {view.chapterTitle && view.type !== 'cutscene' && <div className="chapter-chip">{view.chapterTitle}</div>}
      <div className="story-content">{content}</div>
      {error && (
        <div className="story-error">
          <strong>Story error:</strong> {error}
          <br />
          <small>Fix the story JSON (run "npm run story:check") or load a save.</small>
        </div>
      )}
      <Toasts toasts={toasts} onDone={dismissToast} />
      {overlay === 'status' && <StatusPanel game={game} onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <GameMenu
          onClose={() => setOverlay(null)}
          onSave={save}
          onLoad={(slot) => {
            load(slot)
            setOverlay(null)
          }}
          onQuit={quitToTitle}
        />
      )}
    </div>
  )
}
