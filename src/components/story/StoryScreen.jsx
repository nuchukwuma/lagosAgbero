import { useEffect, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import GameCanvas from '../../game/world/GameCanvas.jsx'
import HUD from '../hud/HUD.jsx'
import FreeRoamControls from '../hud/FreeRoamControls.jsx'
import LoadingOverlay from '../hud/LoadingOverlay.jsx'
import EnergyTicker from '../hud/EnergyTicker.jsx'
import ShopPanel from '../hud/ShopPanel.jsx'
import { useFeeRun } from '../../game/modes/feeCollection/feeRunStore.js'
import { useChase } from '../../game/modes/chase/chaseStore.js'
import { modeComponent } from '../../game/modes/modeRegistry.js'
import street from '../../game/data/world/iyanaWahala.json'
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
import FavourButton from '../hud/FavourButton.jsx'

// The story screen: the 3D street + HUD + whatever the engine says to show.
// During a freeRoam beat the player walks; otherwise the story has the floor.
function ActivityHost({ activity, onFinish }) {
  const Mode = modeComponent(activity.mode)
  return (
    <div className="story-content">
      <Mode key={activity.key} mode={activity.mode} params={activity.params} outcomes={[]} onFinish={onFinish} />
    </div>
  )
}

export default function StoryScreen() {
  const { game, view, toasts, error, advance, choose, save, load, quitToTitle, dismissToast, goTo, activity, startActivity, finishActivity } = useGameStore()
  const [overlay, setOverlay] = useState(null) // 'status' | 'menu' | 'shop:<vendor>' | null
  const feeRunOn = useFeeRun((s) => s.active && s.started && !s.ended)
  const chaseOn = useChase((s) => s.active && s.started && !s.ended)
  const streetMode = feeRunOn || chaseOn

  // Phones kill background tabs: save quietly whenever the game is hidden.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && useGameStore.getState().autosave()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

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
    case 'freeRoam':
      content = null
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
      <GameCanvas view={view} game={game} activity={activity} paused={Boolean(overlay)} onGoalReached={advance} />
      {raining && <div className="rain" aria-hidden="true" />}
      <HUD game={game} onStatus={() => setOverlay('status')} onMenu={() => setOverlay('menu')} />
      {view.chapterTitle && view.type !== 'cutscene' && <div className="chapter-chip">{view.chapterTitle}</div>}
      {view.type === 'freeRoam' && !overlay && !activity && (
        <FreeRoamControls
          view={view}
          onTalk={advance}
          onShop={(v) => setOverlay(`shop:${v}`)}
          onActivity={(id) => {
            const a = (street.activities || []).find((x) => x.id === id)
            if (a) startActivity({ ...a, key: `${a.id}-${Date.now()}` })
          }}
        />
      )}
      {activity && <ActivityHost activity={activity} onFinish={finishActivity} />}
      <EnergyTicker active={(view.type === 'freeRoam' || streetMode) && !overlay} />
      <FavourButton view={view} activity={activity} overlay={overlay} />
      <div className="story-content">{content}</div>
      {error && (
        <div className="story-error">
          <strong>Story error:</strong> {error}
          <br />
          <small>Fix the story JSON (run "npm run story:check") or load a save.</small>
        </div>
      )}
      <Toasts toasts={toasts} onDone={dismissToast} />
      <LoadingOverlay />
      {overlay === 'status' && <StatusPanel game={game} onClose={() => setOverlay(null)} />}
      {overlay?.startsWith('shop:') && <ShopPanel vendor={overlay.slice(5)} onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <GameMenu
          onClose={() => setOverlay(null)}
          onSave={save}
          onLoad={(slot) => {
            load(slot)
            setOverlay(null)
          }}
          onQuit={quitToTitle}
          canDress={view.type === 'freeRoam' && !activity}
        />
      )}
    </div>
  )
}
