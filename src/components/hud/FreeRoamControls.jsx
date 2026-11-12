import { useEffect } from 'react'
import MoveControls from './MoveControls.jsx'
import { useWorldStore } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'

// On-screen controls while walking around: objective, joystick, RUN, TALK.
// Keyboard: WASD / arrows to move, Shift to run, E or Enter to talk.
export default function FreeRoamControls({ view, onTalk }) {
  const canTalk = useWorldStore((s) => s.canTalk)
  const talkName = canTalk ? characters[canTalk]?.name || canTalk : null

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'KeyE' || e.key === 'Enter') && canTalk) onTalk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canTalk, onTalk])


  return (
    <>
      {view.objective && (
        <div className="objective">
          <span className="objective-tag">Objective</span> {view.objective}
        </div>
      )}
      <MoveControls actionLabel={talkName ? 'TALK' : null} actionSub={talkName} onAction={onTalk} />
    </>
  )
}
