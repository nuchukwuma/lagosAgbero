import { useEffect } from 'react'
import { useStreet } from '../../game/world/streetState.js'
import { useGameStore } from '../../game/store/gameStore.js'
import { traffic, LANES } from '../../game/systems/traffic.js'
import { playerState } from '../../game/world/worldState.js'
import { say } from '../../game/world/speech.js'
import { release } from '../../game/world/ReactionDirector.jsx'
import { campaignOf } from '../../game/narrative/campaigns.js'
import { lineFor, effectsFor, argueChance } from '../../game/systems/reactions.js'
import { requestPortrait, usePortrait } from '../../game/characters/portraits.js'
import { sfx } from '../../game/audio/audio.js'

// A driver you kept waiting has got out of the car (ReactionDirector.jsx).
// Say sorry and step aside, argue it out (a feared player can make them back
// down and even pay), or fight. Walking off counts too.

const WHO = { danfo: 'Danfo driver', keke: 'Keke rider', okada: 'Okada man', taxi: 'Taxi driver', truck: 'Lorry driver' }

export default function Confrontation() {
  const confront = useStreet((s) => s.confront)
  const activity = useGameStore((s) => s.activity)
  const game = useGameStore((s) => s.game)
  const key = confront ? `driver-${confront.vehicleId}` : null
  useEffect(() => {
    if (confront) requestPortrait(key, confront.look)
  }, [confront, key])
  const face = usePortrait(key)

  // the fight is over: the driver gets back in and goes
  useEffect(() => {
    if (confront?.fighting && !activity) {
      const v = traffic.vehicles.find((x) => x.id === confront.vehicleId)
      if (v) release(v)
      useStreet.getState().setConfront(null)
    }
  }, [confront, activity])

  useEffect(() => {
    if (!confront || confront.fighting) return undefined
    const onKey = (e) => {
      const pick = { 1: 'sorry', 2: 'argue', 3: 'fight' }[e.key]
      if (pick) choose(pick)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!confront || confront.fighting || !game) return null
  const campaign = campaignOf(game).id
  const who = { name: game.player.name, nick: game.player.nickname }
  const vehicle = () => traffic.vehicles.find((x) => x.id === confront.vehicleId)
  const above = (v) => () => ({ x: v.x, y: 2.6, z: LANES[v.lane].z })
  const { react, startActivity } = useGameStore.getState()

  const fight = () => {
    useStreet.getState().setConfront({ ...confront, fighting: true })
    react('roadRage', { count: { roadRage: 1 } })
    startActivity({
      id: 'roadWahala',
      label: 'ROAD WAHALA',
      mode: 'fight',
      params: { opponent: 'angryDriver', difficulty: 1 },
      minutes: 15,
      results: { won: { changeStat: effectsFor('roadFightWon', campaign) }, lost: { changeStat: effectsFor('roadFightLost', campaign) } },
      key: `roadWahala-${Date.now()}`,
    })
  }

  function choose(pick) {
    const v = vehicle()
    sfx('click')
    if (pick === 'sorry') {
      if (v) {
        say(lineFor('apologised', campaign, who), above(v))
        release(v)
      }
      // step back onto the pavement on your side of the road
      const p = playerState.position
      playerState.teleport = { x: p.x, z: p.z < 0 ? -5.6 : 5.6, facing: playerState.facing }
      useStreet.getState().setConfront(null)
      react('apologise')
      return
    }
    if (pick === 'argue') {
      const street = game.street || {}
      if (Math.random() < argueChance(game.stats, campaign, street.roadRage || 0)) {
        if (v) {
          say(lineFor('argueWon', campaign, who), above(v), { seconds: 3.2 })
          release(v)
        }
        sfx('coin')
        useStreet.getState().setConfront(null)
        react('argueWon', { toast: 'The driver backed down and paid you to let him pass.', count: { roadRage: 1 } })
      } else {
        if (v) say(lineFor('argueLost', campaign, who), above(v), { tone: 'is-angry', seconds: 3 })
        react('argueLost')
        fight()
      }
      return
    }
    fight()
  }

  return (
    <div className="confront" role="dialog" aria-label="A driver confronts you">
      <div className="confront-who">
        <div className={`portrait ${face ? 'has-face' : ''}`} style={{ '--ring': '#c0392b', background: face ? undefined : '#c0392b' }}>
          {face ? <img src={face} alt="" /> : '!'}
        </div>
        <strong>{WHO[confront.kind] || 'Driver'}</strong>
        {confront.again && <span className="confront-tag">knows you</span>}
      </div>
      <p className="confront-line">“{confront.line}”</p>
      <div className="confront-choices">
        <button className="btn" onClick={() => choose('sorry')}>
          <kbd>1</kbd> Say sorry, step aside
        </button>
        <button className="btn" onClick={() => choose('argue')}>
          <kbd>2</kbd> Argue back
        </button>
        <button className="btn btn-danger" onClick={() => choose('fight')}>
          <kbd>3</kbd> Fight
        </button>
      </div>
    </div>
  )
}
