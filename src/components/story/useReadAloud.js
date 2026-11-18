import { useCallback, useEffect, useRef } from 'react'
import { useSettings } from '../../game/store/settings.js'
import { useGameStore } from '../../game/store/gameStore.js'
import { withAllegiance } from '../../game/characters/look.js'
import { speak, stopSpeaking, voicesSupported } from '../../game/audio/voices.js'

/**
 * Reads a story beat aloud (Settings → Voices). `say(speakNow)` is called
 * with a speak function each time the beat changes, and again by replay().
 * `onSaid` runs once everything has been said (hands-free moves on then).
 * Speech stops when the beat goes away.
 */
export function useReadAloud(beatKey, say) {
  const enabled = useSettings((s) => s.voices !== false)
  const playerLook = useGameStore((s) => s.game?.player.look)
  const flags = useGameStore((s) => s.game?.flags)
  const sayRef = useRef(say)
  sayRef.current = say

  const run = useCallback(() => {
    const look = withAllegiance(playerLook || {}, flags || {})
    const voice = (text, speaker, opts = {}) => speak(text, speaker, { ...opts, look: speaker === 'player' ? look : undefined })
    sayRef.current(voice)
  }, [playerLook, flags])

  useEffect(() => {
    if (!enabled || !voicesSupported()) return undefined
    run()
    return stopSpeaking
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, enabled])

  return { canReplay: enabled && voicesSupported(), replay: run }
}

/** Hands-free (Settings → Voices): move on by itself once a line has been said. */
export const handsFree = () => {
  const s = useSettings.getState()
  return s.voices !== false && s.handsFree === true
}
