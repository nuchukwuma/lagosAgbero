import { useEffect, useLayoutEffect, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import GameCanvas from '../../game/world/GameCanvas.jsx'
import CanvasGuard from '../help/CanvasGuard.jsx'
import HUD from '../hud/HUD.jsx'
import OnlineHUD from '../online/OnlineHUD.jsx'
import { disconnect, useOnline } from '../../game/online/net.js'
import { QUEST_GIVERS } from '../../game/online/catalog.js'
import { mapForWorld } from '../../game/online/RemotePlayers.jsx'
import FreeRoamControls from '../hud/FreeRoamControls.jsx'
import LoadingOverlay from '../hud/LoadingOverlay.jsx'
import EnergyTicker from '../hud/EnergyTicker.jsx'
import ShopPanel from '../hud/ShopPanel.jsx'
import { useFeeRun } from '../../game/modes/feeCollection/feeRunStore.js'
import { useChase } from '../../game/modes/chase/chaseStore.js'
import { modeComponent, FULLSCREEN_MODES } from '../../game/modes/modeRegistry.js'
import { useStealth } from '../../game/modes/stealth/stealthStore.js'
import { useCurrentWorld } from '../../game/world/interiors/interiorStore.js'
import { worldJson, getLayout, isInterior } from '../../game/world/worlds.js'
import { MiniMap, MapScreen, useMapStore } from '../hud/WorldMap.jsx'
import Confrontation from '../hud/Confrontation.jsx'
import DialogueBox from './DialogueBox.jsx'
import { usePause } from '../../game/store/pauseStore.js'
import { useAd } from '../../game/services/adService.js'
import ChoiceMenu from './ChoiceMenu.jsx'
import { howToPlay } from '../../game/modes/howToPlay.js'
import Tutorial, { useTutorial, useFirstTimeTutorial, showTutorial } from '../hud/Tutorial.jsx'
import { tutorialFor } from '../../game/modes/tutorials.js'
import NewsBroadcast from './NewsBroadcast.jsx'
import CutsceneCards from './CutsceneCards.jsx'
import ChapterEndCard from './ChapterEndCard.jsx'
import EndingScreen from './EndingScreen.jsx'
import StatusPanel from './StatusPanel.jsx'
import GameMenu from './GameMenu.jsx'
import Toasts from './Toasts.jsx'
import ModeHost from './ModeHost.jsx'
import FavourButton from '../hud/FavourButton.jsx'
import DetourBar from '../hud/DetourBar.jsx'
import StoryMap from './StoryMap.jsx'
import RotateHint, { useTurnHint } from '../hud/RotateHint.jsx'
import { applyOrientation } from '../../game/systems/orientation.js'
import { useSettings } from '../../game/store/settings.js'

const MAP_MODES = new Set(['feeCollection', 'chase', 'sneak', 'shrineHeist']) // (fights are 2D: no map)

// The story screen: the 3D street + HUD + whatever the engine says to show.
// During a freeRoam beat the player walks; otherwise the story has the floor.
function ActivityHost({ activity, onFinish, retryN }) {
  const Mode = modeComponent(activity.mode)
  // 2D modes put their canvas into .story-screen; when the screen and the
  // activity start together (the games menu) it isn't in the page on the first
  // render, so the mode waits one commit for it
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => setMounted(true), [])
  return <div className="story-content">{mounted && <Mode key={`${activity.key}-${retryN}`} mode={activity.mode} params={activity.params} outcomes={[]} onFinish={onFinish} />}</div>
}

export default function StoryScreen() {
  const { game, view, toasts, error, advance, choose, save, load, quitToTitle, dismissToast, goTo, activity, startActivity, finishActivity, lastChoice, undoChoice, raiseMoney, roamFirst, retryN, retryGame } = useGameStore()
  const [overlay, setOverlay] = useState(null) // 'status' | 'menu' | 'shop:<vendor>' | null
  // phones: hold the screen the way the player chose (Settings → Screen)
  const orientation = useSettings((s) => s.orientation)
  useEffect(() => {
    applyOrientation(orientation)
  }, [orientation])
  const turnTo = useTurnHint()
  // a panel over the game, or the phone needs turning: everything holds still
  const adPlaying = useAd((s) => Boolean(s.playing)) // a sponsor message is showing
  const touring = useTutorial((s) => Boolean(s.mode)) // a game's guided tour is showing
  const paused = Boolean(overlay || turnTo || adPlaying || touring)
  // the last objective you were given (activities and dialogue don't carry one)
  const [lastObjective, setLastObjective] = useState(null)
  useEffect(() => {
    if (view?.objective) setLastObjective(view.objective)
  }, [view?.objective])
  useEffect(() => {
    usePause.setState({ paused })
    return () => usePause.setState({ paused: false })
  }, [paused])
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

  // the map: M opens it during free roam; a marked place belongs to its world
  const world = view?.world
  useEffect(() => useMapStore.getState().setWaypoint(null), [world])
  const canMap = view?.type === 'freeRoam' && !activity
  // the small map stays up while you're out on the street: walking around,
  // talking, and in the street modes that happen on this map (not the drive
  // or the escape run, which have their own roads)
  const modeName = activity ? activity.mode : view?.type === 'mode' ? view.mode : null
  useFirstTimeTutorial(modeName)
  // a game played on its own from the Games tab (no story around it)
  // Lagos Online: the shared open world (no story status, no saves)
  const online = Boolean(game?.flags?.online)
  const gamesOnly = Boolean(activity?.fromGames) || online
  // online: the way to the quest giver you asked for (when they're in this place)
  const guide = useOnline((s) => s.guide)
  const guideHere = online && guide && view?.world && QUEST_GIVERS[guide]?.map === mapForWorld(view.world)
  const mapGoal = guideHere ? { talkTo: guide } : view?.type === 'freeRoam' ? view.goal : null
  // the world on screen: the story's, a mode's own (Back Gate), or the building you're in
  const here = useCurrentWorld(view, modeName)
  const inside = isInterior(here)
  // Back Gate: the campus map, pointing at the gate once it's open
  const gateOpen = useStealth((s) => s.hud.open)
  // Steal Untouched: the regalia, then the way out
  const heistGoal = gateOpen ? { point: [30, -9], label: 'The farm road' } : { point: [49.6, -31.6], label: 'The regalia' }
  const showMini = Boolean(view?.world) && (modeName ? MAP_MODES.has(modeName) : ['freeRoam', 'dialogue', 'choice'].includes(view?.type))
  useEffect(() => {
    if (!canMap) return undefined
    const onKey = (e) => {
      if ((e.key === 'm' || e.key === 'M') && !overlay && !e.target.closest?.('input, textarea')) setOverlay('worldMap')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canMap, overlay])

  if (!game || !view) return null

  if (view.type === 'ending') {
    return (
      <>
        <EndingScreen view={view} onTitle={quitToTitle} onLoad={() => goTo('load')} onMap={() => setOverlay('map')} />
        {overlay === 'map' && <StoryMap game={game} onClose={() => setOverlay(null)} />}
      </>
    )
  }

  const raining = Boolean(game.flags.raining)
  let content = null
  switch (view.type) {
    case 'dialogue':
      content = <DialogueBox view={view} onNext={advance} onUndo={lastChoice ? undoChoice : null} />
      break
    case 'choice':
      content = <ChoiceMenu view={view} onChoose={choose} onRaise={raiseMoney} />
      break
    case 'news':
      content = <NewsBroadcast view={view} onNext={advance} />
      break
    case 'cutscene':
      content = <CutsceneCards view={view} onDone={advance} />
      break
    case 'chapterEnd':
      content = <ChapterEndCard view={view} onNext={advance} onMap={() => setOverlay('map')} onRoam={roamFirst} />
      break
    case 'mode':
      content = <ModeHost key={`${view.key}-${retryN}`} view={view} />
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
    <div className={`story-screen ${modeName === 'fight' || FULLSCREEN_MODES.has(modeName) ? 'fighting' : ''}`}>
      <CanvasGuard onBack={quitToTitle}>{(safeGl) => <GameCanvas view={view} game={game} activity={activity} paused={paused} onGoalReached={advance} safeGl={safeGl} />}</CanvasGuard>
      {raining && <div className="rain" aria-hidden="true" />}
      <div id="speech-layer" className="speech-layer" aria-live="polite" />
      {online && <OnlineHUD onMenu={() => setOverlay('menu')} hidden={Boolean(overlay)} />}
      {(!online || activity) && <HUD game={game} gamesOnly={gamesOnly} onStatus={() => setOverlay('status')} onMenu={() => setOverlay('menu')} onMap={view.world ? () => setOverlay('worldMap') : null} />}
      {showMini && !inside && !overlay && (!gamesOnly || (online && !activity)) && <MiniMap layout={getLayout(here)} goal={modeName === 'sneak' ? (gateOpen ? { reach: 'backGate' } : null) : modeName === 'shrineHeist' ? heistGoal : mapGoal} onOpen={modeName ? null : () => setOverlay('worldMap')} />}
      {view.chapterTitle && view.type !== 'cutscene' && !gamesOnly && <div className="chapter-chip">{view.chapterTitle}</div>}
      {view.type === 'freeRoam' && !overlay && !activity && (
        <FreeRoamControls
          view={view}
          onTalk={advance}
          onShop={(v) => setOverlay(`shop:${v}`)}
          onQuest={(q) => useGameStore.getState().startQuest(q)}
          onActivity={(id) => {
            const a = (worldJson(here).activities || []).find((x) => x.id === id)
            if (a) startActivity({ ...a, key: `${a.id}-${Date.now()}` })
          }}
        />
      )}
      {view.type === 'freeRoam' && view.detour && !overlay && !activity && <DetourBar view={view} />}
      {activity && <ActivityHost activity={activity} onFinish={finishActivity} retryN={retryN} />}
      {view.type === 'freeRoam' && !overlay && <Confrontation />}
      <EnergyTicker active={(view.type === 'freeRoam' || streetMode) && !overlay} />
      {!online && <FavourButton view={view} activity={activity} overlay={overlay} />}
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
      <RotateHint want={turnTo} />
      {overlay === 'status' && <StatusPanel game={game} onClose={() => setOverlay(null)} />}
      {overlay === 'map' && <StoryMap game={game} onClose={() => setOverlay(null)} />}
      {overlay === 'worldMap' && view.world && <MapScreen layout={getLayout(view.world)} goal={mapGoal} onClose={() => setOverlay(null)} />}
      {overlay?.startsWith('shop:') && <ShopPanel vendor={overlay.slice(5)} onClose={() => setOverlay(null)} />}
      <Tutorial />
      {overlay === 'menu' && (
        <GameMenu
          onClose={() => setOverlay(null)}
          onSave={save}
          onLoad={(slot) => {
            load(slot)
            setOverlay(null)
          }}
          quitLabel={online && !activity ? 'Leave Lagos Online' : activity && online ? 'Give up this game' : null}
          onQuit={online && !activity ? () => {
            disconnect()
            quitToTitle()
          } : gamesOnly ? () => {
            setOverlay(null)
            finishActivity({ outcome: 'quit' })
          } : quitToTitle}
          gamesOnly={gamesOnly}
          canDress={view.type === 'freeRoam' && !activity}
          onMap={() => setOverlay('map')}
          objective={view.objective || lastObjective}
          chapter={view.chapterTitle}
          activity={activity?.label || null}
          howTo={modeName ? howToPlay(modeName, (activity ? activity.params : view.params) || {}) : null}
          onTutorial={modeName && tutorialFor(modeName) ? () => {
            setOverlay(null)
            showTutorial(modeName)
          } : null}
          onRetry={modeName && !activity?.params?.online ? () => {
            setOverlay(null)
            retryGame()
          } : null}
        />
      )}
    </div>
  )
}
