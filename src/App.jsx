import { useGameStore } from './game/store/gameStore.js'
import TitleScreen from './components/TitleScreen.jsx'
import AboutScreen from './components/AboutScreen.jsx'
import EndingsScreen from './components/EndingsScreen.jsx'
import GamesScreen from './components/GamesScreen.jsx'
import OnlineScreen from './components/OnlineScreen.jsx'
import { lazy, Suspense, useEffect } from 'react'
import { roomFromUrl, setRoomIntent } from './game/online/invite.js'
// dev tool: loaded only when opened, so it stays out of the main bundle
const AssetBrowser = lazy(() => import('./components/AssetBrowser.jsx'))
import NewGameScreen from './components/NewGameScreen.jsx'
import SaveSlots from './components/SaveSlots.jsx'
import StoryScreen from './components/story/StoryScreen.jsx'
import { AdOverlay } from './components/hud/FavourButton.jsx'
import MockCheckout from './components/menu/MockCheckout.jsx'
import ShareCardModal from './components/share/ShareCardModal.jsx'
import AudioDirector from './game/audio/AudioDirector.jsx'

function Screen() {
  const screen = useGameStore((s) => s.screen)
  const { goTo, newGame, continueGame, load } = useGameStore.getState()
  const back = () => goTo('title')

  switch (screen) {
    case 'about':
      return <AboutScreen onBack={back} />
    case 'endings':
      return <EndingsScreen onBack={back} />
    case 'games':
      return <GamesScreen onBack={back} />
    case 'online':
      return <OnlineScreen onBack={back} />
    case 'assets':
      return (
        <Suspense fallback={null}>
          <AssetBrowser onBack={back} />
        </Suspense>
      )
    case 'newGame':
      return <NewGameScreen onStart={newGame} onBack={back} />
    case 'load':
      return (
        <div className="screen load-screen">
          <h2>Load game</h2>
          <SaveSlots mode="load" onLoad={load} />
          <button className="btn" onClick={back}>
            Back
          </button>
        </div>
      )
    case 'story':
      return <StoryScreen />
    default:
      return <TitleScreen onNavigate={goTo} onContinue={continueGame} />
  }
}

export default function App() {
  // an invite link (?room=ABCD): straight to joining that room
  useEffect(() => {
    const code = roomFromUrl()
    if (code) {
      setRoomIntent({ code })
      useGameStore.getState().goTo('online')
    }
  }, [])
  return (
    <>
      <Screen />
      <AudioDirector />
      <AdOverlay />
      <MockCheckout />
      <ShareCardModal />
    </>
  )
}
