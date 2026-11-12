import { useEffect } from 'react'
import MoveControls from './MoveControls.jsx'
import { useWorldStore } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'
import { worldJson } from '../../game/world/worlds.js'
import { QUESTS } from '../../game/systems/quests.js'

// On-screen controls while walking around: objective, joystick, RUN, TALK.
// Keyboard: WASD / arrows to move, Shift to run, E or Enter to talk.
export default function FreeRoamControls({ view, onTalk, onShop, onActivity, onQuest }) {
  const canTalk = useWorldStore((s) => s.canTalk)
  const talkName = canTalk ? characters[canTalk]?.name || canTalk : null
  const nearVendor = useWorldStore((s) => s.nearVendor)
  const vendorName = nearVendor ? characters[nearVendor]?.name || nearVendor : null
  const nearActivity = useWorldStore((s) => s.nearActivity)
  const activity = nearActivity ? (worldJson(view.world).activities || []).find((a) => a.id === nearActivity) : null
  const nearQuest = useWorldStore((s) => s.nearQuest)
  const quest = !canTalk && nearQuest ? QUESTS.find((q) => q.id === nearQuest) : null

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.key === 'Enter') {
        if (canTalk) onTalk()
        else if (quest) onQuest(quest)
        else if (activity) onActivity(activity.id)
        else if (nearVendor) onShop(nearVendor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canTalk, onTalk, nearVendor, onShop, activity, onActivity, quest, onQuest])


  return (
    <>
      {view.objective && (
        <div className="objective">
          <span className="objective-tag">Objective</span> {view.objective}
        </div>
      )}
      <MoveControls
        actionLabel={talkName ? 'TALK' : quest ? `QUEST: ${quest.title}` : activity ? activity.label : vendorName ? 'BUY' : null}
        actionIcon={talkName ? 'talk' : quest ? 'quest' : activity ? activity.icon || 'star' : 'buy'}
        actionSub={talkName || (quest ? quest.title : activity ? activity.where : vendorName)}
        onAction={() => (talkName ? onTalk() : quest ? onQuest(quest) : activity ? onActivity(activity.id) : nearVendor && onShop(nearVendor))}
      />
    </>
  )
}
