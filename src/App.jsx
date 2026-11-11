import { useState } from 'react'
import TitleScreen from './components/TitleScreen.jsx'
import AboutScreen from './components/AboutScreen.jsx'
import AssetBrowser from './components/AssetBrowser.jsx'

// Phase 0 shell: a title screen, the About screen and a developer asset check.
// The real game screens (story, street, modes) arrive from Phase 1 onwards.
export default function App() {
  const [screen, setScreen] = useState('title')

  if (screen === 'about') return <AboutScreen onBack={() => setScreen('title')} />
  if (screen === 'assets') return <AssetBrowser onBack={() => setScreen('title')} />
  return <TitleScreen onNavigate={setScreen} />
}
