import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore.js'
import { useSettings } from '../store/settings.js'
import { unlock, sfx, setMusic, setAmbience, setVolumes, suspend } from './audio.js'
import characters from '../data/characters.json'

// Connects the game to the sound engine. Nothing else needs to know about
// audio: this watches the store (money, dialogue, modes, time of day) and
// plays the right thing. Modes add their own effects with sfx('punch') etc.

const TENSE = new Set(['fight', 'chase', 'runner'])
const ROLLING = new Set(['drive', 'conductor'])

function voicePitch(speaker) {
  if (!speaker || speaker === 'narrator') return 0
  let h = 0
  for (const c of speaker) h = (h * 31 + c.charCodeAt(0)) % 997
  const female = characters[speaker]?.look?.body?.startsWith('female')
  return (female ? 1.45 : 0.8) + (h % 40) / 100
}

export default function AudioDirector() {
  // browsers need a tap or a key before any sound
  useEffect(() => {
    const go = () => unlock()
    window.addEventListener('pointerdown', go, { passive: true })
    window.addEventListener('keydown', go)
    const click = (e) => {
      if (e.target.closest?.('button, .choice-btn, select')) sfx('click')
    }
    document.addEventListener('pointerdown', click, { passive: true, capture: true })
    const hide = () => suspend(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
      document.removeEventListener('pointerdown', click, { capture: true })
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  // settings: music / sound on-off
  useEffect(() => {
    const apply = (s) => setVolumes({ music: s.music !== false, sound: s.sound !== false })
    apply(useSettings.getState())
    return useSettings.subscribe(apply)
  }, [])

  useEffect(() => {
    let last = { money: null, key: null, toasts: 0, screen: null, mode: null }
    const react = (s) => {
      const { screen, game, view, activity, toasts } = s
      if (screen !== 'story' || !game || !view) {
        setMusic('menu')
        setAmbience({ street: 0, rain: 0, night: 0 })
        last = { money: null, key: null, toasts: 0, screen, mode: null }
        return
      }
      // music + ambience follow the situation
      const mode = activity ? activity.mode : view.type === 'mode' ? view.mode : null
      const dark = view.time === 'night' || view.time === 'dusk'
      setMusic(view.type === 'ending' ? 'night' : TENSE.has(mode) ? 'tension' : ROLLING.has(mode) ? 'drive' : dark ? 'night' : 'street')
      setAmbience({ street: view.type === 'ending' || view.type === 'cutscene' ? 0.25 : 1, rain: game.flags.raining ? 1 : 0, night: view.time === 'night' ? 1 : 0 })

      // money in / out
      const money = game.stats.money
      let moneySound = false
      if (last.money !== null && money !== last.money) {
        const d = money - last.money
        sfx(d >= 2000 ? 'cash' : d > 0 ? 'coin' : 'spend')
        moneySound = true
      }
      // a new story beat
      const key = `${view.type}|${view.key ?? ''}|${view.text ?? view.headline ?? ''}`
      if (key !== last.key) {
        if (view.type === 'dialogue') {
          const p = voicePitch(view.speaker)
          if (p) sfx('talk', p)
        } else if (view.type === 'choice') sfx('open')
        else if (view.type === 'news') sfx('radio')
        else if (view.type === 'cutscene') sfx('whoosh')
        else if (view.type === 'chapterEnd') sfx('win')
        else if (view.type === 'ending') sfx(view.id === 'rock_bottom' || view.id === 'jailed' ? 'lose' : 'win')
      }
      if (mode !== last.mode && mode && TENSE.has(mode)) sfx('whistle')
      if (toasts.length > last.toasts && !moneySound) sfx('notify')
      last = { money, key, toasts: toasts.length, screen, mode }
    }
    react(useGameStore.getState())
    return useGameStore.subscribe(react)
  }, [])

  return null
}
