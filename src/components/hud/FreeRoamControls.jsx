import { useEffect } from 'react'
import MoveControls from './MoveControls.jsx'
import { useWorldStore } from '../../game/world/worldState.js'
import characters from '../../game/data/characters.json'
import { worldJson } from '../../game/world/worlds.js'
import { QUESTS } from '../../game/systems/quests.js'
import ObjectiveBanner from './ObjectiveBanner.jsx'
import Icon from '../Icon.jsx'
import { useCurrentWorld } from '../../game/world/interiors/interiorStore.js'

// On-screen controls while walking around: objective, joystick, RUN, TALK.
// Keyboard: WASD / arrows to move, Shift to run, E or Enter to talk.
export default function FreeRoamControls({ view, onTalk, onShop, onActivity, onQuest }) {
  const canTalk = useWorldStore((s) => s.canTalk)
  const talkName = canTalk ? characters[canTalk]?.name || canTalk : null
  const nearVendor = useWorldStore((s) => s.nearVendor)
  const vendorName = nearVendor ? characters[nearVendor]?.name || nearVendor : null
  const nearActivity = useWorldStore((s) => s.nearActivity)
  const here = worldJson(useCurrentWorld(view, null)) // the street, or the building you're in
  const activity = nearActivity ? (here.activities || []).find((a) => a.id === nearActivity) : null
  const nearActivities = useWorldStore((s) => s.nearActivities)
  const others = canTalk ? [] : nearActivities.slice(1).map((id) => (here.activities || []).find((a) => a.id === id)).filter(Boolean)
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
      <ObjectiveBanner text={view.objective} />
      {others.length > 0 && (
        <div className="activity-more" aria-label="More things to do here">
          {others.map((a) => (
            <button key={a.id} className="activity-chip" onClick={() => onActivity(a.id)}>
              <Icon name={a.icon || 'star'} size={16} /> {a.label}
            </button>
          ))}
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
