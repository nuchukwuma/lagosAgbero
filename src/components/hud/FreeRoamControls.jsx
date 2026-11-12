import { useEffect } from 'react'
import MoveControls from './MoveControls.jsx'
import { useWorldStore } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'
import street from '../../game/data/world/iyanaWahala.json'

// On-screen controls while walking around: objective, joystick, RUN, TALK.
// Keyboard: WASD / arrows to move, Shift to run, E or Enter to talk.
export default function FreeRoamControls({ view, onTalk, onShop, onActivity }) {
  const canTalk = useWorldStore((s) => s.canTalk)
  const talkName = canTalk ? characters[canTalk]?.name || canTalk : null
  const nearVendor = useWorldStore((s) => s.nearVendor)
  const vendorName = nearVendor ? characters[nearVendor]?.name || nearVendor : null
  const nearActivity = useWorldStore((s) => s.nearActivity)
  const activity = nearActivity ? (street.activities || []).find((a) => a.id === nearActivity) : null

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.key === 'Enter') {
        if (canTalk) onTalk()
        else if (activity) onActivity(activity.id)
        else if (nearVendor) onShop(nearVendor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canTalk, onTalk, nearVendor, onShop, activity, onActivity])


  return (
    <>
      {view.objective && (
        <div className="objective">
          <span className="objective-tag">Objective</span> {view.objective}
        </div>
      )}
      <MoveControls
        actionLabel={talkName ? 'TALK' : activity ? activity.label : vendorName ? 'BUY' : null}
        actionIcon={talkName ? 'talk' : activity ? activity.icon || 'star' : 'buy'}
        actionSub={talkName || (activity ? activity.where : vendorName)}
        onAction={() => (talkName ? onTalk() : activity ? onActivity(activity.id) : nearVendor && onShop(nearVendor))}
      />
    </>
  )
}
