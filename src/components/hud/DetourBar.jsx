import { useEffect, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { showRewardedAd } from '../../game/services/adService.js'
import { playerState } from '../../game/world/worldState.js'
import { getLayout } from '../../game/world/worlds.js'

// While the story waits for the player (story.detour, see storyEngine.js):
//   travel  "Make your way to the chapel": walk there, or skip the walk for an ad
//   raise   a choice costs more than you have: hustle, then the story comes back
//           to the choice by itself; or go back now and choose something else
//   roam    free time between chapters: carry on whenever you like
export default function DetourBar({ view }) {
  const advance = useGameStore((s) => s.advance)
  const money = useGameStore((s) => s.game?.stats.money ?? 0)
  const [busy, setBusy] = useState(false)

  // raising money: as soon as the pocket holds enough, back to the choice
  useEffect(() => {
    if (view.detour === 'raise' && money >= view.amount) advance()
  }, [view.detour, view.amount, money, advance])

  if (!view.detour) return null
  if (view.detour === 'travel')
    return (
      <div className="detour-bar">
        <button
          className="btn btn-small"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await showRewardedAd('skip:travel')
            setBusy(false)
            if (!ok) return
            // straight there
            const spot = getLayout(view.world)?.spots?.[view.goal?.reach]
            if (spot) playerState.teleport = { x: spot.pos[0], z: spot.pos[1], facing: ((spot.facing ?? 0) * Math.PI) / 180 }
            advance()
          }}
        >
          Skip the walk (watch an ad)
        </button>
      </div>
    )
  if (view.detour === 'raise')
    return (
      <div className="detour-bar">
        <button className="btn btn-small" onClick={advance}>
          Back to the story without it
        </button>
      </div>
    )
  return (
    <div className="detour-bar">
      <button className="btn btn-small btn-primary" onClick={advance}>
        Continue the story ▸
      </button>
    </div>
  )
}
