import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBattle, phaseAt, tap, advanceTo, battleResult, MOVES, MOVE_IDS } from './danceLogic.js'
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

// A dance battle, seen like the pixel fights: you and the rival on a stage in
// front of wherever this is (the bus stop, the village square, the hostel),
// the crowd behind jumping and cheering as the hype rises. The rival dances a
// routine on the beat (each move shown as they dance it); then you repeat
// it, tapping each move on its beat, and your dancer dances what you tap.
// Story params:
//   rival   a character id (their look) or nothing (a stranger)
//   name    what to call the rival
//   rounds  (3) · length (4: moves in the first routine) · bpm (96) · skill (0.6)
//   prize   naira for winning (paid with the result)
// Outcomes: won | lost
// Keys: 1-5 for the moves.

const KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }

export default function DanceMode({ params, onFinish }) {
  const canvasRef = useRef()
  const game = useGameStore((s) => s.game)
  const time = useGameStore((s) => s.view?.time || 'day')
  const world = useGameStore((s) => s.view?.world || 'iyanaWahala')
  const activitySpot = useGameStore((s) => s.activity?.spot)
  const bpm = params.bpm ?? 96
  const battle = useMemo(() => createBattle({ rounds: params.rounds ?? 3, length: params.length ?? 4, skill: params.skill ?? 0.6, seed: params.seed ?? Math.floor(Math.random() * 999) }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const dancers = useMemo(() => {
    const rivalLook = params.rival && characters[params.rival] ? characters[params.rival].look : randomLook(params.seed ?? 77, 'male')
    return { p: makePixelFighter(withAllegiance(game?.player.look || {}, game?.flags || {})), o: makePixelFighter(rivalLook) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const rivalName = params.name || (params.rival && characters[params.rival]?.name) || 'The rival'
  const [stage, setStage] = useState('intro') // intro | dancing | done
  const [hud, setHud] = useState({ phase: 'count', round: 0, step: -1, you: 0, rival: 0, hype: 0.3, marks: [], beat: 0 })
  const clock = useRef({ beats: -2, lastTap: null, playerMove: null, playerAt: -9 })
  const firstTime = useState(() => !seenIntro('dance'))[0]

  // the dance floor
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
    const layout = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(1, Math.round(r.width))
      H = Math.max(1, Math.round(r.height))
      canvas.width = W
      canvas.height = H
      const portrait = H > W
      groundY = H * (portrait ? 0.62 : 0.8)
      PX = Math.max(2, Math.round(Math.min((H * 0.3) / 21, (W / (portrait ? 4.6 : 7.4)) * M_PER_PX)))
      groundY = Math.round(groundY / PX) * PX
      backdrop = makePixelStage({ W, H, PX, groundY: groundY + PX * 6, pan: 1, time, kind, place, light, seed: 41 })
    }
    layout()
    window.addEventListener('resize', layout)
    let raf = 0
    let last = performance.now()
    let t = 0
    let lastBeat = -99
    let hudT = 0
    // which of a move's two frames: swapped every half beat (the count-in starts below zero: keep it positive)
    const half = (beats) => ((Math.floor(beats * 2) % 2) + 2) % 2
    const frameOf = (fighter, move, beats) => {
      const F = fighter.frames
      if (move) return F[`dance_${move}`][half(beats)]
      return F.stand[half(beats)]
    }
    const drawDancer = (fighter, frame, x, facing) => {
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.translate(Math.round(x), groundY)
      ctx.scale(facing * PX, PX)
      ctx.drawImage(frame.canvas, -AX, -AY, CW, CH)
      ctx.restore()
    }
    const label = (text, color, x, y, alpha) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = `900 ${Math.max(14, PX * 3)}px ui-monospace, Menlo, Consolas, monospace`
      ctx.textAlign = 'center'
      ctx.lineWidth = Math.max(3, PX)
      ctx.strokeStyle = '#0e0d1e'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
      ctx.restore()
    }
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      const c = clock.current
      const running = c.started && !battle.over && !isPaused()
      if (running) c.beats += (dt * bpm) / 60
      if (c.started) advanceTo(battle, c.beats)
      t += isPaused() ? 0 : dt
      const ph = phaseAt(battle, c.beats)
      // a click on every beat, a little louder on the rival's and yours
      const beatNow = Math.floor(c.beats)
      if (running && beatNow !== lastBeat) {
        lastBeat = beatNow
        if (ph.phase !== 'done') sfx('click')
      }
      if (battle.over && c.started && !c.ended) {
        c.ended = true
        sfx(battleResult(battle).outcome === 'won' ? 'win' : 'lose')
        setTimeout(() => setStage('done'), 600)
      }
      // draw
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (backdrop) backdrop.draw(ctx, 0, t, battle.hype)
      // the stage: planks on trestles, a light rig at dusk and night
      const sw = Math.min(W * 0.86, PX * 120)
      const sx = Math.round((W - sw) / 2 / PX) * PX
      ctx.fillStyle = '#1a1630'
      ctx.fillRect(sx - PX, groundY - PX, sw + 2 * PX, PX * 7)
      ctx.fillStyle = '#8a6a44'
      ctx.fillRect(sx, groundY, sw, PX * 2)
      ctx.fillStyle = '#6b4f30'
      ctx.fillRect(sx, groundY + PX * 2, sw, PX * 4)
      for (let x = sx; x < sx + sw; x += PX * 8) {
        ctx.fillStyle = '#4a3420'
        ctx.fillRect(x, groundY + PX * 2, PX, PX * 4)
      }
      if (time === 'night' || time === 'dusk') {
        // two spotlights sweeping with the beat
        for (const side of [0, 1]) {
          const a = Math.sin(c.beats * Math.PI * 0.5 + side * Math.PI) * 0.25
          ctx.save()
          ctx.globalAlpha = 0.18 + battle.hype * 0.15
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
      // the dancers: the rival dances the routine on their turn; you dance what you tap
      const pX = W / 2 - PX * 22
      const oX = W / 2 + PX * 22
      const rivalMove = ph.phase === 'rival' ? battle.plan[ph.round].moves[Math.max(0, ph.step)] : null
      const youMove = c.playerMove && c.beats - c.playerAt < 0.9 ? c.playerMove : null
      drawDancer(dancers.o, frameOf(dancers.o, rivalMove, c.beats), oX, -1)
      drawDancer(dancers.p, frameOf(dancers.p, youMove, c.beats), pX, 1)
      if (rivalMove) label(MOVES[rivalMove].name.toUpperCase(), MOVES[rivalMove].color, oX, groundY - PX * 24, 1)
      if (youMove) label(MOVES[youMove].name.toUpperCase(), c.lastMark === 'miss' ? '#bbbbbb' : MOVES[youMove].color, pX, groundY - PX * 24, Math.max(0, 1 - (c.beats - c.playerAt)))
      if (c.lastMark && c.beats - c.playerAt < 0.8) label(c.lastMark === 'perfect' ? 'PERFECT!' : c.lastMark === 'good' ? 'GOOD' : 'MISS', c.lastMark === 'miss' ? '#ff6b4a' : '#ffffff', pX, groundY - PX * 29, 1 - (c.beats - c.playerAt))
      if (ph.phase === 'count' && c.started) {
        const p = battle.plan[ph.round]
        const nextAt = c.beats < p.rivalAt ? p.rivalAt : p.youAt
        const n = Math.ceil(nextAt - c.beats)
        label(n <= 3 ? String(n) : c.beats < p.rivalAt ? `ROUND ${ph.round + 1}` : 'YOUR TURN', '#ffd23a', W / 2, groundY - PX * 38, 1)
      }
      hudT -= dt
      if (hudT <= 0) {
        hudT = 0.1
        setHud({ phase: ph.phase, round: ph.round, step: ph.step, you: battle.you, rival: battle.rival, hype: battle.hype, marks: battle.marks[ph.round] || [], beat: c.beats })
      }
    }
    raf = requestAnimationFrame(frame)
    if (import.meta.env.DEV) window.__dance = { battle, clock }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', layout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dance = (move) => {
    const c = clock.current
    if (!c.started || battle.over) return
    const r = tap(battle, c.beats, move)
    if (!r) return
    c.playerMove = move
    c.playerAt = c.beats
    c.lastMark = r.mark
    sfx(r.mark === 'miss' ? 'wrong' : 'correct')
    if (r.mark === 'perfect' && battle.hype > 0.7) sfx('crowd')
  }

  useEffect(() => {
    const onKey = (e) => {
      if (KEYS[e.code] != null) dance(MOVE_IDS[KEYS[e.code]])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const host = typeof document !== 'undefined' ? document.querySelector('.story-screen') : null
  const floor = <canvas ref={canvasRef} className="fight2d-canvas" aria-label="Dance battle" />
  const res = stage === 'done' ? battleResult(battle) : null
  const round = battle.plan[hud.round]
  return (
    <>
      {host ? createPortal(floor, host) : floor}
      {stage === 'intro' && (
        <div className="fee-intro">
          <h2>Dance battle: {rivalName}</h2>
          {firstTime ? (
            <ul>
              <li>{rivalName} dances a routine on the beat. Watch the moves.</li>
              <li>Then it's your turn: tap the same moves, one a beat, in the same order.</li>
              <li>On the beat is PERFECT, a little off is GOOD; the wrong move or a missed beat cools the crowd.</li>
              <li>Three rounds, each routine one move longer. The bigger score wins.</li>
            </ul>
          ) : (
            <p>Watch, then repeat it on the beat. Three rounds.</p>
          )}
          {params.prize ? <p>Prize: {formatNaira(params.prize)}</p> : null}
          <button
            className="btn btn-primary"
            onClick={() => {
              markIntroSeen('dance')
              clock.current.started = true
              setStage('dancing')
            }}
          >
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
            {round && (
              <div className="dance-routine">
                {round.moves.map((m, i) => {
                  const shown = hud.phase === 'you' || (hud.phase === 'rival' && i <= hud.step) || (hud.phase === 'count' && hud.beat > round.rivalAt + round.moves.length - 1)
                  const now = (hud.phase === 'rival' || hud.phase === 'you') && i === hud.step
                  const mark = hud.marks[i]
                  return (
                    <span key={i} className={`dance-step ${now ? 'now' : ''} ${mark || ''}`} style={{ background: shown ? MOVES[m].color : undefined }}>
                      {shown ? MOVES[m].name : '?'}
                    </span>
                  )
                })}
              </div>
            )}
            <div className="dance-turn">{hud.phase === 'rival' ? `${rivalName} is dancing: watch!` : hud.phase === 'you' ? 'Your turn: repeat it on the beat!' : 'Get ready…'}</div>
          </div>
          <div className="dance-pad">
            {MOVE_IDS.map((m, i) => (
              <button key={m} className="dance-btn" style={{ background: MOVES[m].color }} onPointerDown={(e) => (e.preventDefault(), dance(m))}>
                <small>{i + 1}</small>
                {MOVES[m].name}
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
          {res.outcome === 'won' && params.prize ? <p>Prize: {formatNaira(params.prize)}</p> : null}
          <button className="btn btn-primary" onClick={() => onFinish({ ...res, moneyChange: res.outcome === 'won' ? params.prize || 0 : 0 })}>
            Continue
          </button>
        </div>
      )}
    </>
  )
}
