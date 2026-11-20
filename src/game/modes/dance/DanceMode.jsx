import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBattle, phaseAt, tap, advanceTo, battleResult, LANES, roundTempo, roundAt } from './danceLogic.js'
import { makePixelFighter, M_PER_PX, CW, CH, AX, AY } from '../fight/fight2d/pixel.js'
import { makePixelStage, backdropFor } from '../fight/fight2d/pixelStage.js'
import { placeHere } from '../fight/fight2d/where.js'
import { useGameStore } from '../../store/gameStore.js'
import { useSettings, effectiveQuality } from '../../store/settings.js'
import { isPaused } from '../../store/pauseStore.js'
import { randomLook, withAllegiance } from '../../characters/look.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'
import { formatNaira } from '../../narrative/stats.js'
import { seenIntro, markIntroSeen } from '../../systems/records.js'
import { storyCtx } from '../../narrative/storyData.js'
import { storyLevel } from '../../systems/progress.js'
import { usePowerups } from '../../systems/powerups.js'
import PowerupOffer from '../../../components/hud/PowerupOffer.jsx'
import { tuneParams } from '../arcade/tuning.js'

// A dance battle as a 4-lane rhythm game, on a stage in front of wherever
// this is (the bus stop, the village square, the hostel), the crowd behind
// jumping as the hype rises. Arrows fall down four lanes; tap each lane as
// its arrow reaches the line. The rival dances a phrase first (watch their
// arrows), then it's your turn. Every arrow you hit is a dance move, so your
// dancer dances what you tap: ← Shaku, ↓ Gwara, ↑ Zanku, → Azonto.
// Story params:
//   rival   a character id (their look) or nothing (a stranger)
//   name    what to call the rival
//   rounds  (3) · length (8 beats in the first phrase) · bpm (100) · skill (0.6)
//   prize   naira for winning (paid with the result)
// Harder as the story goes on; ad power-ups slow the beat or widen the timing.
// Outcomes: won | lost
// Keys: arrows, or D F J K.

const KEYS = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 }
const LOOKAHEAD = 2.6 // beats of arrows on screen above the line

export default function DanceMode({ params: given, onFinish }) {
  const canvasRef = useRef()
  const game = useGameStore((s) => s.game)
  const time = useGameStore((s) => s.view?.time || 'day')
  const world = useGameStore((s) => s.view?.world || 'iyanaWahala')
  const activitySpot = useGameStore((s) => s.activity?.spot)
  const level = useMemo(() => given.level ?? storyLevel(useGameStore.getState().game, storyCtx.chapters), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0)
  // settings for this battle: the story's, tuned to the story level and any power-ups bought
  const params = useMemo(() => tuneParams('dance', given, level, usePowerups.getState().active), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const bpm = params.bpm ?? 100
  const windows = params.windows ?? 1
  const battle = useMemo(() => createBattle({ rounds: params.rounds ?? 3, length: params.length ?? 8, skill: params.skill ?? 0.6, level: params.level ?? 0.3, seed: (params.seed ?? Math.floor(Math.random() * 999)) + round * 13 }), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const dancers = useMemo(() => {
    const rivalLook = given.rival && characters[given.rival] ? characters[given.rival].look : randomLook(given.seed ?? 77, 'male')
    return { p: makePixelFighter(withAllegiance(game?.player.look || {}, game?.flags || {})), o: makePixelFighter(rivalLook) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rivalName = given.name || (given.rival && characters[given.rival]?.name) || 'The rival'
  const [stage, setStage] = useState('intro') // intro | dancing | done
  const [hud, setHud] = useState({ phase: 'count', you: 0, rival: 0, hype: 0.3, combo: 0, round: 0 })
  const clock = useRef({ beats: -2, started: false, pressed: [0, 0, 0, 0], youMove: null, youAt: -9, judge: null, judgeAt: -9, rivalMove: null, rivalAt: -9 })
  const live = useRef(battle)
  live.current = battle
  const tempo = useRef({ bpm, windows })
  tempo.current = { bpm, windows }
  const firstTime = useState(() => !seenIntro('dance'))[0]

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const light = effectiveQuality(useSettings.getState().quality) === 'low'
    const { kind, place } = backdropFor(world, placeHere(world, activitySpot))
    let W = 0
    let H = 0
    let PX = 6
    let groundY = 0
    let backdrop = null
    let lane = { x: 0, w: 0, top: 0, hitY: 0 }
    const layout = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(1, Math.round(r.width))
      H = Math.max(1, Math.round(r.height))
      canvas.width = W
      canvas.height = H
      const portrait = H > W
      groundY = H * (portrait ? 0.58 : 0.74)
      PX = Math.max(2, Math.round(Math.min((H * 0.26) / 21, (W / (portrait ? 5.5 : 8)) * M_PER_PX)))
      groundY = Math.round(groundY / PX) * PX
      backdrop = makePixelStage({ W, H, PX, groundY: groundY + PX * 6, pan: 1, time, kind, place, light, seed: 41 })
      // the arrow highway, in the middle, ending just above the buttons
      const w = Math.min(W * (portrait ? 0.66 : 0.4), 360)
      const top = Math.max(96, H * 0.2)
      lane = { x: (W - w) / 2, w, top, hitY: H - Math.max(100, H * 0.19) }
    }
    layout()
    window.addEventListener('resize', layout)
    let raf = 0
    let last = performance.now()
    let t = 0
    let lastBeat = -99
    let hudT = 0
    const half = (beats) => ((Math.floor(beats * 2) % 2) + 2) % 2
    const drawDancer = (fighter, frameName, x, facing, beats) => {
      const F = fighter.frames
      const frames = F[frameName] || F.stand
      const frame = frames[half(beats) % frames.length]
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.translate(Math.round(x), groundY)
      ctx.scale(facing * PX, PX)
      ctx.drawImage(frame.canvas, -AX, -AY, CW, CH)
      ctx.restore()
    }
    const label = (text, color, x, y, alpha, size = Math.max(14, PX * 3)) => {
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
      ctx.font = `900 ${size}px ui-monospace, Menlo, Consolas, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = Math.max(3, size / 5)
      ctx.strokeStyle = '#0e0d1e'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
      ctx.restore()
    }
    // an arrow tile: a chunky square with the arrow on it
    const arrowTile = (li, cx, cy, size, { fill, dim = false, glow = false } = {}) => {
      const L = LANES[li]
      const s = Math.round(size)
      ctx.save()
      ctx.globalAlpha = dim ? 0.55 : 1
      ctx.fillStyle = '#0e0d1e'
      ctx.fillRect(Math.round(cx - s / 2) - 2, Math.round(cy - s / 2) - 2, s + 4, s + 4)
      ctx.fillStyle = fill || L.color
      ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s)
      if (glow) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, Math.round(s / 3))
      }
      ctx.restore()
      label(L.arrow, '#ffffff', cx, cy + 1, dim ? 0.6 : 1, Math.round(s * 0.62))
    }
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      const c = clock.current
      const b = live.current
      const running = c.started && !b.over && !isPaused()
      if (running) c.beats += (dt * roundTempo(tempo.current.bpm, roundAt(live.current, c.beats))) / 60
      if (c.started) {
        // the rival dances their arrows as they reach the line
        for (const n of b.notes) if (n.who === 'rival' && !n.mark && c.beats >= n.beat) {
          c.rivalMove = LANES[n.lane].move
          c.rivalAt = c.beats
          c.rivalMiss = n.rivalMark === 'miss'
        }
        const before = b.counts.miss
        advanceTo(b, c.beats, tempo.current.windows)
        if (b.counts.miss > before) {
          c.judge = 'MISS'
          c.judgeAt = c.beats
          c.youMove = null
          c.stumble = c.beats
          sfx('wrong')
        }
      }
      t += isPaused() ? 0 : dt
      const ph = phaseAt(b, c.beats)
      const beatNow = Math.floor(c.beats)
      if (running && beatNow !== lastBeat) {
        lastBeat = beatNow
        if (ph.phase !== 'done') sfx('click')
      }
      if (b.over && c.started && !c.ended) {
        c.ended = true
        sfx(battleResult(b).outcome === 'won' ? 'win' : 'lose')
        setTimeout(() => setStage('done'), 600)
      }
      // the stage
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (backdrop) backdrop.draw(ctx, 0, t, b.hype)
      const sw = Math.min(W * 0.94, PX * 150)
      const sx = Math.round((W - sw) / 2 / PX) * PX
      ctx.fillStyle = '#1a1630'
      ctx.fillRect(sx - PX, groundY - PX, sw + 2 * PX, PX * 7)
      ctx.fillStyle = '#8a6a44'
      ctx.fillRect(sx, groundY, sw, PX * 2)
      ctx.fillStyle = '#6b4f30'
      ctx.fillRect(sx, groundY + PX * 2, sw, PX * 4)
      if (time === 'night' || time === 'dusk') {
        for (const side of [0, 1]) {
          const a = Math.sin(c.beats * Math.PI * 0.5 + side * Math.PI) * 0.25
          ctx.save()
          ctx.globalAlpha = 0.16 + b.hype * 0.14
          ctx.fillStyle = side ? '#ffd23a' : '#7fd0ff'
          ctx.beginPath()
          const top = side ? W * 0.85 : W * 0.15
          ctx.moveTo(top, 0)
          ctx.lineTo(W / 2 + Math.sin(a) * W * 0.35 - PX * 14, groundY)
          ctx.lineTo(W / 2 + Math.sin(a) * W * 0.35 + PX * 14, groundY)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
      }
      // the dancers, either side of the arrows: you dance what you hit; they dance theirs
      // each dancer in the middle of the space beside the arrows
      const pX = Math.max(PX * 12, lane.x / 2)
      const oX = Math.min(W - PX * 12, lane.x + lane.w + (W - lane.x - lane.w) / 2)
      const youFrame = c.stumble != null && c.beats - c.stumble < 0.6 ? 'hit' : c.youMove && c.beats - c.youAt < 0.8 ? `dance_${c.youMove}` : 'stand'
      const rivalFrame = c.rivalMove && c.beats - c.rivalAt < 0.8 ? (c.rivalMiss ? 'hit' : `dance_${c.rivalMove}`) : 'stand'
      drawDancer(dancers.p, youFrame, pX, 1, c.beats)
      drawDancer(dancers.o, rivalFrame, oX, -1, c.beats)
      label('YOU', '#ffd23a', pX, groundY + PX * 10, 0.9, Math.max(11, PX * 2.4))
      label(rivalName.toUpperCase(), '#bfe8ff', oX, groundY + PX * 10, 0.9, Math.max(11, PX * 2.4))
      // the arrow highway
      const lw = lane.w / 4
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = '#0e0d1e'
      ctx.fillRect(lane.x, lane.top, lane.w, lane.hitY - lane.top + lw * 0.6)
      ctx.restore()
      for (let i = 1; i < 4; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(Math.round(lane.x + i * lw), lane.top, 1, lane.hitY - lane.top)
      }
      const yours = ph.phase === 'you' || (ph.phase === 'count' && b.plan[ph.round] && c.beats > b.plan[ph.round].rivalAt)
      // the receptors at the line
      const size = Math.min(lw * 0.72, (lane.hitY - lane.top) / 4.2, 58)
      for (let i = 0; i < 4; i++) {
        const lit = c.pressed[i] > 0
        arrowTile(i, lane.x + lw * (i + 0.5), lane.hitY, size, { fill: lit ? LANES[i].color : '#2a2540', glow: lit })
        if (c.pressed[i] > 0) c.pressed[i] -= dt
      }
      // the falling arrows: theirs during their phrase (danced for them), yours during yours
      const ppb = (lane.hitY - lane.top) / LOOKAHEAD
      for (const n of b.notes) {
        const ahead = n.beat - c.beats
        if (ahead > LOOKAHEAD + 0.2 || ahead < -0.6) continue
        if (n.mark && (n.who === 'rival' || n.mark !== 'miss')) continue
        const y = lane.hitY - ahead * ppb
        const x = lane.x + lw * (n.lane + 0.5)
        arrowTile(n.lane, x, y, size * 0.9, { dim: n.who === 'rival' || n.mark === 'miss' })
      }
      // what you just got
      if (c.judge && c.beats - c.judgeAt < 0.9) {
        const col = c.judge === 'PERFECT' ? '#8ff0a4' : c.judge === 'GOOD' ? '#ffd23a' : '#ff6b4a'
        label(c.judge, col, lane.x + lane.w / 2, lane.hitY - ppb * 1.1, 1 - (c.beats - c.judgeAt), Math.max(16, PX * 4))
        if (b.combo >= 4) label(`${b.combo} COMBO`, '#ffffff', lane.x + lane.w / 2, lane.hitY - ppb * 1.1 + Math.max(18, PX * 4.5), 1 - (c.beats - c.judgeAt), Math.max(12, PX * 2.8))
      }
      // the count-in and whose turn
      if (ph.phase === 'count' && c.started) {
        const p = b.plan[ph.round]
        const nextAt = c.beats < p.rivalAt ? p.rivalAt : p.youAt
        const left = Math.ceil(nextAt - c.beats)
        label(left <= 3 ? String(left) : c.beats < p.rivalAt ? `ROUND ${ph.round + 1}` : 'YOUR TURN!', '#ffd23a', lane.x + lane.w / 2, lane.top + (lane.hitY - lane.top) * 0.4, 1, Math.max(22, PX * 6))
      } else if (ph.phase === 'rival') label(`${rivalName.toUpperCase()}: WATCH`, '#bfe8ff', lane.x + lane.w / 2, lane.top + 12, 1, Math.max(12, PX * 2.4))
      else if (yours && ph.phase === 'you') label('YOUR TURN!', '#ffd23a', lane.x + lane.w / 2, lane.top + 12, 1, Math.max(12, PX * 2.4))
      hudT -= dt
      if (hudT <= 0) {
        hudT = 0.1
        setHud({ phase: ph.phase, you: b.you, rival: b.rival, hype: b.hype, combo: b.combo, round: ph.round })
      }
    }
    raf = requestAnimationFrame(frame)
    if (import.meta.env.DEV) window.__dance = { battle: live, clock }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', layout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hit = (li) => {
    const c = clock.current
    const b = live.current
    if (!c.started || b.over || isPaused()) return
    c.pressed[li] = 0.12
    const r = tap(b, c.beats, li, windows)
    if (r.mark === 'stray') return
    c.youMove = LANES[li].move
    c.youAt = c.beats
    c.judge = r.mark.toUpperCase()
    c.judgeAt = c.beats
    c.stumble = null
    sfx(r.mark === 'perfect' ? 'correct' : 'click')
    if (r.mark === 'perfect' && b.combo % 10 === 0 && b.hype > 0.6) sfx('crowd')
  }

  useEffect(() => {
    const onKey = (e) => {
      if (KEYS[e.code] != null && !e.repeat) {
        e.preventDefault()
        hit(KEYS[e.code])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const host = typeof document !== 'undefined' ? document.querySelector('.story-screen') : null
  const floor = <canvas ref={canvasRef} className="fight2d-canvas" aria-label="Dance battle" />
  const res = stage === 'done' ? battleResult(live.current) : null
  const start = () => {
    markIntroSeen('dance')
    setRound((n) => n + 1) // a fresh battle, with any power-ups just bought
    clock.current = { ...clock.current, beats: -2, started: true, ended: false, pressed: [0, 0, 0, 0], youMove: null, rivalMove: null, judge: null, stumble: null }
    setStage('dancing')
  }
  return (
    <>
      {host ? createPortal(floor, host) : floor}
      {stage === 'intro' && (
        <div className="fee-intro">
          <h2>Dance battle: {rivalName}</h2>
          {firstTime ? (
            <ul>
              <li>Arrows fall down four lanes. Tap the lane (← ↓ ↑ →) as each arrow reaches the line at the bottom.</li>
              <li>On the line is PERFECT, a little off is GOOD; let one pass and it's a MISS, and your combo starts again.</li>
              <li>{rivalName} dances a phrase first (watch their arrows), then it's your turn. Every arrow you hit is a move your dancer does.</li>
              <li>Three rounds, each busier than the last. The bigger score wins.</li>
            </ul>
          ) : (
            <p>Tap each lane as its arrow reaches the line. Watch them, then your turn.</p>
          )}
          {given.prize ? <p>Prize: {formatNaira(given.prize)}</p> : null}
          <p className="arcade-level">
            Difficulty <strong>{'★'.repeat(1 + Math.round(level * 4))}{'☆'.repeat(4 - Math.round(level * 4))}</strong>
          </p>
          <PowerupOffer mode="dance" />
          <button className="btn btn-primary" onClick={start}>
            Oya, dance!
          </button>
        </div>
      )}
      {stage === 'dancing' && (
        <>
          <div className="dance-hud">
            <div className="dance-score">
              <span>YOU {hud.you}</span>
              <div className="dance-hype" title="The crowd">
                <div style={{ width: `${Math.round(hud.hype * 100)}%` }} />
              </div>
              <span>
                {rivalName.toUpperCase()} {hud.rival}
              </span>
            </div>
          </div>
          <div className="dance-pad lanes">
            {LANES.map((L, i) => (
              <button key={L.id} className="dance-btn lane" style={{ background: L.color }} onPointerDown={(e) => (e.preventDefault(), hit(i))} aria-label={L.name}>
                <span className="lane-arrow">{L.arrow}</span>
                <small>{L.name}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {res && (
        <div className="fee-intro">
          <h2>{res.outcome === 'won' ? 'The crowd chose you!' : `${rivalName} takes it.`}</h2>
          <p>
            You {res.you} · {rivalName} {res.rival}
          </p>
          <p className="muted">
            {res.counts.perfect} perfect · {res.counts.good} good · {res.counts.miss} missed · best combo {res.best}
          </p>
          {res.outcome === 'won' && given.prize ? <p>Prize: {formatNaira(given.prize)}</p> : null}
          <div className="result-actions">
            <button className="btn btn-primary" onClick={() => onFinish({ ...res, moneyChange: res.outcome === 'won' ? given.prize || 0 : 0 })}>
              Continue
            </button>
            {res.outcome !== 'won' && (
              <button className="btn" onClick={start}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
