import { useEffect } from 'react'
import { isFemale } from '../characters/look.js'
import { useGameStore } from '../store/gameStore.js'
import { playVoice, preloadVoices } from './voice/voice.js'
import { useSettings } from '../store/settings.js'
import { unlock, sfx, setMusic, setAmbience, setVolumes, suspend, duckMusic, setScene, onCall } from './audio.js'
import { onSpeaking, voicesSupported, shout } from './voices.js'
import characters from '../data/characters.json'

// Connects the game to the sound engine. Nothing else needs to know about
// audio: this watches the store (money, dialogue, modes, time of day) and
// plays the right thing. Modes add their own effects with sfx('punch') etc.

const TENSE = new Set(['fight', 'chase', 'runner'])
// what you hear around you, by activity, then by place (audio.js SCENES)
const SCENE_OF_MODE = { feeCollection: 'busPark', conductor: 'busPark', chase: 'chase', fight: 'fight', runner: 'runner', drive: 'drive', rally: 'rally', begging: 'market' }
const SCENE_OF_WORLD = { iyanaWahala: 'market', nkwoAgu: 'village', royalCrest: 'campus' }
const ROLLING = new Set(['drive', 'conductor'])

function voicePitch(speaker) {
  if (!speaker || speaker === 'narrator') return 0
  let h = 0
  for (const c of speaker) h = (h * 31 + c.charCodeAt(0)) % 997
  const female = isFemale(characters[speaker]?.look?.body)
  return (female ? 1.45 : 0.8) + (h % 40) / 100
}

export default function AudioDirector() {
  // browsers need a tap or a key before any sound
  useEffect(() => {
    // (phones only count the end of a touch as a tap, so listen for that too)
    const go = () => unlock()
    const UNLOCK = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']
    for (const e of UNLOCK) window.addEventListener(e, go, { passive: true })
    const click = (e) => {
      if (e.target.closest?.('button, .choice-btn, select')) sfx('click')
    }
    document.addEventListener('pointerdown', click, { passive: true, capture: true })
    const hide = () => suspend(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', hide)
    return () => {
      for (const e of UNLOCK) window.removeEventListener(e, go)
      document.removeEventListener('pointerdown', click, { capture: true })
      document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  // music drops while someone speaks
  useEffect(() => onSpeaking(duckMusic), [])
  // distant calls (conductors, hawkers, the crowd) in voices, if voices are on
  useEffect(() => {
    // (not during the run, a fight or any other activity: only the story is read out)
    onCall((line) => useSettings.getState().voices !== false && !useGameStore.getState().activity && shout(line))
    return () => onCall(null)
  }, [])

  // Baba Radio: now and then, out on the street, a recorded bulletin from somebody's radio
  useEffect(() => {
    const pool = ['radio_news', 'radio_raid', 'radio_bet']
    let next = pool[Math.floor(Math.random() * pool.length)]
    let id = 0
    const tick = () => {
      const { view, activity, game } = useGameStore.getState()
      if (view?.type === 'freeRoam' && !activity) {
        if (playVoice(next, { fx: 'radio', volume: 0.55 })) next = pool.filter((x) => x !== next)[Math.floor(Math.random() * (pool.length - 1))]
        else if (game) preloadVoices([next]) // ready for next time
      }
      id = setTimeout(tick, (240 + Math.random() * 180) * 1000)
    }
    id = setTimeout(tick, 90 * 1000)
    return () => clearTimeout(id)
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
      // calls only out on the street, not over dialogue or cutscenes
      setScene(mode ? SCENE_OF_MODE[mode] || 'market' : view.type === 'freeRoam' ? SCENE_OF_WORLD[view.world] || 'market' : 'quiet')

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
          // the little "talk" chirp, unless the line is read aloud
          const spoken = useSettings.getState().voices !== false && voicesSupported()
          const p = voicePitch(view.speaker)
          if (p && !spoken) sfx('talk', p)
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
