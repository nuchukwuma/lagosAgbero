import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { webglSupport } from '../../game/world/webgl.js'
import { trimCache } from '../../game/world/assetCache.js'
import { useGameStore } from '../../game/store/gameStore.js'
import { campaignById } from '../../game/narrative/campaigns.js'
import { worldJson } from '../../game/world/worlds.js'
import { ASSET_ROOT } from '../../assets/assetManifest.js'
import { useWarmup } from '../../game/world/ShaderWarmup.jsx'

// drei's progress store updates on every single file the loader finishes,
// sometimes several times within one React render. Reading it with the hook
// re-renders this component for each one, and a burst of a few hundred files
// (the crowd, the clips) trips React's "maximum update depth" guard. So we
// listen outside React and copy the numbers in at most once per frame.
function useLoadProgress() {
  const [state, setState] = useState(() => {
    const { active, progress } = useProgress.getState()
    return { active, progress }
  })
  useEffect(() => {
    let frame = 0
    const flush = () => {
      frame = 0
      const { active, progress } = useProgress.getState()
      setState((s) => (s.active === active && s.progress === progress ? s : { active, progress }))
    }
    const unsubscribe = useProgress.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(flush)
    })
    flush() // catch anything that changed before we subscribed
    return () => {
      unsubscribe()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return state
}

// Shown while a world's models download. Each story has its own loading
// screen (its picture, place and lines, from campaigns.json "art" and
// "loading"), shown the first time you start or load that story in a visit.
// After that, later downloads (a new mode's models, a bus stop's people)
// only show a small pill, never a full-screen cover in the middle of play.
const shownFor = new Set() // stories whose full loading screen has been seen this visit
const MIN_SHOW_MS = 1400 // long enough to see the picture, even when everything is cached

export default function LoadingOverlay() {
  const { active, progress } = useLoadProgress()
  const warmed = useWarmup((s) => s.warmed) // the world's GPU programs are ready
  const campaign = campaignById(useGameStore((s) => s.game?.campaign))
  const world = useGameStore((s) => s.view?.world)
  const lines = campaign.loading?.lines || ['Loading…']
  const [line, setLine] = useState(0)
  const [full] = useState(() => !shownFor.has(campaign.id))
  const [visible, setVisible] = useState(true)
  const [shownAt] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % lines.length), 1400)
    return () => clearInterval(id)
  }, [lines.length])
  useEffect(() => {
    if (!active && progress >= 100 && warmed) {
      trimCache() // keep the shared images, drop the downloaded model files
      const wait = full ? Math.max(300, MIN_SHOW_MS - (Date.now() - shownAt)) : 300
      const id = setTimeout(() => {
        setVisible(false)
        shownFor.add(campaign.id)
      }, wait)
      return () => clearTimeout(id)
    }
    setVisible(true)
  }, [active, progress, warmed, full, shownAt, campaign.id])
  const cover = visible && full && !shownFor.has(campaign.id)
  useEffect(() => {
    useWarmup.setState({ cover })
    return () => useWarmup.setState({ cover: false })
  }, [cover])
  if (!visible || !webglSupport().ok) return null // nothing will load: the help screen explains why
  if (!full || shownFor.has(campaign.id))
    return (
      <div className="loading-pill" aria-live="polite">
        <span className="spinner" /> {Math.round(progress)}%
      </div>
    )
  const place = worldJson(world).name || campaign.loading?.place
  return (
    <div className="loading-overlay" style={campaign.art ? { '--art': `url(${ASSET_ROOT}/${campaign.art})` } : undefined}>
      <div className="loading-art" aria-hidden="true" />
      <div className="loading-content">
        <small className="loading-place">{place}</small>
        <h2>{campaign.title}</h2>
        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <p>{lines[line % lines.length]}</p>
      </div>
    </div>
  )
}
