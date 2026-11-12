import { useEffect, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { canOfferAd, showRewardedAd, REWARDS, ADS_PER_DAY, useAd } from '../../game/services/adService.js'

// An optional favour during free roam (a mock rewarded ad in costume).
export default function FavourButton({ view, activity, overlay }) {
  const game = useGameStore((s) => s.game)
  const grantFavour = useGameStore((s) => s.grantFavour)
  const playing = useAd((s) => s.playing)
  const adsToday = game?.ads?.day === game?.stats.day ? game.ads.count : 0
  const [placement] = useState(() => (Math.random() < 0.5 ? 'radioJingle' : 'garbaTea'))
  if (!game || playing || !canOfferAd({ view, activity, overlay, adsToday })) return null
  const r = REWARDS[placement]
  return (
    <button
      className="favour-btn"
      onClick={async () => {
        if (await showRewardedAd(placement)) grantFavour(r.reward)
      }}
      title={`${r.label} (${ADS_PER_DAY - adsToday} left today)`}
    >
      📻 Favour <small>{r.rewardText}</small>
    </button>
  )
}

/** Full-screen "sponsor message" with a short countdown. */
export function AdOverlay() {
  const playing = useAd((s) => s.playing)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!playing) return undefined
    setLeft(playing.seconds)
    const id = setInterval(() => setLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [playing])
  if (!playing) return null
  const r = REWARDS[playing.placement]
  return (
    <div className="overlay ad-overlay">
      <div className="panel">
        <div className="ad-tag">SPONSORED · TEST AD</div>
        <h2>{playing.sponsor.brand}</h2>
        <p>"{playing.sponsor.line}"</p>
        <p className="muted">{r.label}</p>
        {left > 0 ? (
          <button className="btn" onClick={() => playing.done(false)}>
            Leave now (no reward) · {left}s
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => playing.done(true)}>
            Collect {r.rewardText}
          </button>
        )}
      </div>
    </div>
  )
}
