import { useEffect, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import Icon from '../Icon.jsx'
import { canOfferAd, showRewardedAd, REWARDS, ADS_PER_DAY, useAd, pickPlacement } from '../../game/services/adService.js'
import { campaignOf } from '../../game/narrative/campaigns.js'
import { POWERUPS } from '../../game/systems/powerups.js'

// An optional favour during free roam (a mock rewarded ad in costume).
export default function FavourButton({ view, activity, overlay }) {
  const game = useGameStore((s) => s.game)
  const grantFavour = useGameStore((s) => s.grantFavour)
  const playing = useAd((s) => s.playing)
  const adsToday = game?.ads?.day === game?.stats.day ? game.ads.count : 0
  const [roll] = useState(() => Math.random())
  if (!game || playing || !canOfferAd({ view, activity, overlay, adsToday })) return null
  const placement = pickPlacement(campaignOf(game), roll)
  const r = REWARDS[placement]
  return (
    <button
      className="favour-btn"
      onClick={async () => {
        if (await showRewardedAd(placement)) grantFavour(r.reward)
      }}
      title={`${r.label} (${ADS_PER_DAY - adsToday} left today)`}
      aria-label={`Favour: ${r.label}`}
    >
      <Icon name="radio" size={18} /> <small>{r.rewardText}</small>
    </button>
  )
}

/** Full-screen "sponsor message" with a short countdown. */
export function AdOverlay() {
  const playing = useAd((s) => s.playing)
  // the countdown runs from when the ad started, so "Collect" can't show early
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!playing) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [playing])
  const left = playing ? Math.max(0, Math.ceil(playing.seconds - (now - (playing.startedAt ?? now)) / 1000)) : 0
  if (!playing) return null
  // favours have their own reward; power-ups name theirs (systems/powerups.js)
  const pu = playing.placement?.startsWith('powerup:') ? POWERUPS[playing.placement.slice(8)] : null
  const revive = playing.placement?.startsWith('revive:')
  const r = REWARDS[playing.placement] || (revive ? { label: 'Watch it through and you get back up.', rewardText: 'Get back up' } : { label: pu ? `Power-up: ${pu.name}. ${pu.text}.` : 'Thanks for watching', rewardText: pu ? pu.name : 'reward' })
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
