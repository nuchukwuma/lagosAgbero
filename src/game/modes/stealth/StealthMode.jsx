import { useEffect, useState } from 'react'
import { useStealth, mission } from './stealthStore.js'
import { takedown, missionResult, MISSIONS } from './stealthLogic.js'
import { doTakedown, doGrab } from './StealthDirector.jsx'
import { useGameStore } from '../../store/gameStore.js'
import { playerState } from '../../world/worldState.js'
import { input } from '../../player/input.js'
import MoveControls from '../../../components/hud/MoveControls.jsx'
import TaskPanel from '../../../components/hud/TaskPanel.jsx'
import PowerupOffer from '../../../components/hud/PowerupOffer.jsx'
import { formatNaira } from '../../narrative/stats.js'
import { openShareCard } from '../../../components/share/shareCard.js'
import { playVoice, preloadVoices } from '../../audio/voice/voice.js'

// Back Gate: the overlay for the 3D stealth mission (StealthDirector runs the
// night inside the campus). Intro, the mission panel, TAKE DOWN, the result.

// What each mission says: its intro, rules, panel, and share card.
const TEXT = {
  backGate: {
    title: 'Back Gate',
    intro: 'Night on campus. The porter has locked the hostel and the guards are walking their rounds with torches. Get out through the back gate before dawn.',
    goal: 'Every guard asleep opens the back gate.',
    home: 'the hostel',
    go: 'Sneak out',
    brief: 'brief_backGate',
    panel: 'BACK GATE',
    clockIcon: '🌅',
    share: { kicker: 'Back Gate · Royal Crest', title: 'Out through the back gate', tone: 'neon' },
  },
  shrineHeist: {
    title: 'Steal Untouched',
    intro: "The rival confraternity's shrine compound, in the bush east of Ike's house. Their regalia sits on the altar. Bring it back to the farm road. Do it without one sentry seeing you, and the whole creek will talk: respect ×3.",
    goal: 'Take the regalia from the altar, then get back to the farm road.',
    home: 'the farm road',
    go: 'Move in',
    brief: 'brief_heist',
    panel: 'STEAL UNTOUCHED',
    clockIcon: '🌘',
    share: { kicker: 'Creek & Confraternity', title: 'Stolen untouched', tone: 'neon' },
  },
  raidEscape: {
    title: 'EFCC Raid Escape',
    intro: 'Night, in the Rich Street duplex. You hear the gate go. Operatives are coming through the front door one after another, torches up. Grab the hard drive, the laptop and the cash from the safe, and get out through the back door in the office.',
    goal: 'Take all three (each one you carry slows you down), then out through the back door.',
    home: 'the bedroom',
    go: 'Move',
    brief: 'raid_efcc',
    brief2: 'brief_raidEscape',
    panel: 'EFCC RAID',
    clockIcon: '🚨',
    share: { kicker: 'The Forbes List Trap · Lekki', title: 'Escaped the EFCC raid with ₦50M', tone: 'green' },
  },
  penthouseRaid: {
    title: 'Penthouse Raid',
    intro: 'The top floor of a Maitama tower, at night. Security walks the rooms; cameras watch the lounge and the study. Crack the safe in the study (stand still at it), take the gold from the bedroom, and leave over the balcony.',
    goal: 'Crack the safe and take the gold (heavy: you will be slow), then out over the balcony at the east end of the study.',
    home: 'the front door',
    go: 'Go in',
    brief: 'brief_heist',
    panel: 'PENTHOUSE RAID',
    clockIcon: '🌃',
    share: { kicker: 'The Maitama Mirage · Abuja', title: 'Emptied a Maitama penthouse', tone: 'gold' },
  },
  warehouseHeist: {
    title: 'Warehouse Stock Heist',
    intro: "A Computer Village warehouse after closing. Containers stacked like streets, night watchmen with torches. Take the phone cartons, the laptops and copy the ledger, and leave through the loading dock.",
    goal: 'The phone cartons, the laptops, the ledger (stand still to copy it), then the loading dock at the far end.',
    home: 'the side door',
    go: 'Slip in',
    brief: 'brief_heist',
    panel: 'WAREHOUSE',
    clockIcon: '🌙',
    share: { kicker: "Oga Master's Apprentice · Computer Village", title: 'Cleared the warehouse', tone: 'gold' },
  },
  examSneak: {
    title: 'Exam-Hall Sneak',
    intro: "The exam hall, ten minutes before the paper. Invigilators walk the aisles. Take the question paper from their table and swap your script onto the marking pile. Walk inside an invigilator's sightline and it is over: stand still if one turns to you.",
    goal: 'The question paper (front table), then swap your script (the marking table), then back out the door. Never move while an invigilator can see you.',
    home: 'the door',
    go: 'Go in',
    brief: 'announce_campus',
    panel: 'EXAM HALL',
    clockIcon: '📝',
    share: { kicker: 'Sort or Carryover · Royal Crest', title: 'Sorted the exam', tone: 'neon' },
  },
  hostelDash: {
    title: 'Midnight Hostel Dash',
    intro: 'The syndicate meet-up ran late. Roll call is at midnight and campus security is out with torches. Get from the meet-up behind the senate to your hostel without being seen.',
    goal: 'Reach your hostel door (the green ring) before roll call.',
    home: 'the meet-up',
    go: 'Run',
    brief: 'announce_campus',
    panel: 'HOSTEL DASH',
    clockIcon: '🕛',
    share: { kicker: 'Sort or Carryover · Royal Crest', title: 'Made roll call', tone: 'neon' },
  },
  paperRelay: {
    title: 'Paper-Drop Relay',
    intro: 'Three sealed packets, three drop zones: the library, the chapel, the field. Then to the senate building before the exam bell. Campus security is about.',
    goal: 'Drop a packet at each of the three zones, then get to the senate building.',
    home: 'the quad',
    go: 'Go',
    brief: 'announce_campus',
    panel: 'PAPER DROPS',
    clockIcon: '🔔',
    share: { kicker: 'Sort or Carryover · Royal Crest', title: 'Every packet delivered', tone: 'neon' },
  },
  droneDodge: {
    title: 'Estate Gate & Drone Dodge',
    intro: "Pearl Estate, Lekki, after midnight. Estate security walks the streets, a camera watches the gate, and three drones circle overhead. Somebody wants the Chairman followed.",
    goal: "Tear the night's page out of the gate log (at the guard post), plant a tracker on the Chairman's SUV, then out to the keke on the expressway.",
    home: 'the expressway',
    go: 'Over the wall',
    panel: 'PEARL ESTATE',
    clockIcon: '⏳',
    share: { kicker: 'The Forbes List Trap · Lekki', title: 'Past the drones', tone: 'green' },
  },
  serverBreak: {
    title: 'Server-Room Breakers',
    intro: 'A Lekki tech hub, after hours. Flip the three overload breakers and pull the two drives before the lockdown doors seal. Security sweeps the aisles; a camera watches the far corner.',
    goal: 'Flip three breakers (stand still at each), pull two drives, then out the door before the lockdown.',
    home: 'the door',
    go: 'Go in',
    brief: 'brief_raidEscape',
    panel: 'SERVER ROOM',
    clockIcon: '⏳',
    share: { kicker: 'The Forbes List Trap · Lekki', title: 'Broke the server room', tone: 'green' },
  },
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function StealthMode({ params: given = {}, onFinish, mission: missionId }) {
  const id = missionId || given.mission || 'backGate'
  const params = { ...given, mission: id }
  const text = TEXT[id] || TEXT.backGate
  const active = useStealth((s) => s.active)
  const started = useStealth((s) => s.started)
  const ended = useStealth((s) => s.ended)
  const hud = useStealth((s) => s.hud)
  const [result, setResult] = useState(null)
  const online = Boolean(params.online)

  useEffect(() => {
    // remember where you stood: you're put back there after the night
    const home = { x: playerState.position.x, z: playerState.position.z, facing: playerState.facing }
    const world = useGameStore.getState().view?.world
    useStealth.getState().start(params)
    preloadVoices([text.brief, text.brief2].filter(Boolean))
    return () => {
      input.runButton = false
      useStealth.getState().reset()
      if (world === MISSIONS[id]?.world) playerState.teleport = home // same place: straight back
      else playerState.restore = home // GameCanvas puts you back once your own world is loaded again
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ended && !result && mission.current) setResult(missionResult(mission.current))
  }, [ended, result])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.code === 'KeyE' || e.key === 'Enter') && useStealth.getState().started) {
        const cg = useStealth.getState().hud.canGrab
        if (cg !== false && cg != null) doGrab()
        else doTakedown(takedown)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!active) return null
  if (!started)
    return (
      <div className="fee-intro">
        <h2>{text.title}</h2>
        <p>{text.intro}</p>
        <ul className="move-list">
          <li>
            <strong>Stay out of the torch beams.</strong> In a beam, a <b>?</b> fills over the guard's head; when it's full, he runs for you. Containers, bins and walls block his view.
          </li>
          <li>
            <strong>Walk, don't run.</strong> You move crouched. Running is quicker, but guards close by hear it.
          </li>
          <li>
            <strong>Take them down from behind:</strong> get next to a guard who hasn't seen you and press <b>TAKE DOWN</b> (E). He drops his money. A guard who finds a sleeping colleague comes looking.
          </li>
          <li>
            <strong>{text.goal}</strong> Caught, you start again from {text.home} ({hud.tries || 3} tries).
          </li>
        </ul>
        <p className="muted">Move with the stick or WASD / arrows; turn the camera by dragging, or V.</p>
        <PowerupOffer mode="sneak" />
        <button
          className="btn btn-primary"
          onClick={() => {
            useStealth.getState().begin()
            playVoice(text.brief, { fx: id === 'raidEscape' ? 'megaphone' : 'radio' })
            if (text.brief2) setTimeout(() => playVoice(text.brief2, { fx: 'radio' }), 2600)
          }}
        >
          {text.go}
        </button>
      </div>
    )
  if (ended && result) {
    const won = result.outcome === 'won'
    return (
      <div className="fee-intro">
        <h2>{result.headline}</h2>
        <p>{result.line}</p>
        <p>Score {result.score}{result.moneyChange && !params.recreational ? ` · +${formatNaira(result.moneyChange)}` : ''}</p>
        <div className="result-actions">
          <button className="btn btn-primary" onClick={() => onFinish(result)}>
            Continue
          </button>
          {won && (
            <button
              className="btn"
              onClick={() =>
                openShareCard({
                  ...text.share,
                  title: id === 'shrineHeist' && !result.untouched ? 'Got the regalia' : text.share.title,
                  line: `${result.headline}`,
                  stats: [
                    ['Guards asleep', mission.current?.takedowns ?? 0],
                    ['Taken', formatNaira(result.moneyChange || 0)],
                    ['Score', result.score],
                  ],
                })
              }
            >
              Share
            </button>
          )}
          {!won && !online && (
            <button
              className="btn"
              onClick={() => {
                setResult(null)
                useStealth.getState().retry()
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  const can = hud.canTakedown != null
  const grab = hud.canGrab !== false && hud.canGrab != null
  return (
    <>
      <TaskPanel className={hud.chased ? 'is-danger' : ''}>
        <div className="fee-row">
          <strong>{text.panel}</strong>
          <span>
            {text.clockIcon} {clock(hud.time)}
          </span>
        </div>
        <div className="fee-row">
          <span>
            {id === 'hostelDash'
              ? `To your hostel · security awake: ${hud.left} of ${hud.total}`
              : TEXT[id] && !['raidEscape', 'shrineHeist', 'backGate'].includes(id)
              ? hud.hasLoot
                ? 'All done: get out!'
                : `Still to do: ${hud.lootLeft ?? '?'} · guards awake: ${hud.left} of ${hud.total}${hud.cameras ? ` · ${hud.cameras} camera${hud.cameras > 1 ? 's' : ''}` : ''}${hud.drones ? ` · ${hud.drones} drone${hud.drones > 1 ? 's' : ''}` : ''}`
              : id === 'raidEscape'
              ? hud.hasLoot
                ? 'You have everything: out the back door!'
                : `Still to take: ${hud.lootLeft ?? 3} · operatives inside: ${hud.total - (hud.waiting ?? 0)}`
              : id === 'shrineHeist'
              ? hud.hasLoot
                ? 'The regalia is yours: back to the farm road!'
                : `Sentries awake: ${hud.left} of ${hud.total} · the regalia is on the altar`
              : hud.open
                ? 'The gate is open: go!'
                : `Guards awake: ${hud.left} of ${hud.total}`}
          </span>
          <span>
            {'♥'.repeat(Math.max(0, hud.tries))} · {formatNaira(hud.cash)}
          </span>
        </div>
        {hud.chased && <div className="fee-row stealth-warn">He has seen you! Break his line of sight.</div>}
        {hud.working && (
          <div className="fee-row stealth-work">
            <span>{hud.working.label}… stand still</span>
            <span className="stealth-bar">
              <i style={{ width: `${Math.round(hud.working.p * 100)}%` }} />
            </span>
          </div>
        )}
        {id === 'shrineHeist' && <div className={`fee-row ${hud.spotted ? 'stealth-warn' : 'stealth-clean'}`}>{hud.spotted ? 'Seen: not untouched any more.' : 'Untouched so far.'}</div>}
      </TaskPanel>
      {hud.caught && <div className="stealth-caught">Caught! Back to {text.home}.</div>}
      <MoveControls actionLabel={grab ? hud.grabVerb || 'TAKE IT' : can ? 'TAKE DOWN' : null} actionIcon={grab ? 'hand' : 'fist'} actionSub={grab ? (id === 'shrineHeist' ? 'the regalia' : (hud.grabVerb || 'grab it').toLowerCase()) : can ? 'take down' : null} onAction={() => (grab ? doGrab() : doTakedown(takedown))} />
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => {
            const m = mission.current
            if (m) Object.assign(m, { over: true, won: true })
            useStealth.setState({ ended: { over: true } })
          }}
        >
          Win (dev)
        </button>
      )}
    </>
  )
}
