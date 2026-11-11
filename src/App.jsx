import { useGameStore } from './game/store/gameStore.js'
import TitleScreen from './components/TitleScreen.jsx'
import AboutScreen from './components/AboutScreen.jsx'
import AssetBrowser from './components/AssetBrowser.jsx'
import NewGameScreen from './components/NewGameScreen.jsx'
import SaveSlots from './components/SaveSlots.jsx'
import StoryScreen from './components/story/StoryScreen.jsx'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const { goTo, newGame, continueGame, load } = useGameStore.getState()
  const back = () => goTo('title')

  switch (screen) {
    case 'about':
      return <AboutScreen onBack={back} />
    case 'assets':
      return <AssetBrowser onBack={back} />
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
