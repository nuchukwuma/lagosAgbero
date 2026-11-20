import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { viewFor } from './px.js'
import { isPaused } from '../../store/pauseStore.js'
import { sfx } from '../../audio/audio.js'
import { formatNaira } from '../../narrative/stats.js'
import { seenIntro, markIntroSeen, bestScore, recordScore, recordPlay, practiceBump, rewardMulFor } from '../../systems/records.js'
import { useGameStore } from '../../store/gameStore.js'
import { storyCtx } from '../../narrative/storyData.js'
import { storyLevel } from '../../systems/progress.js'
import { usePowerups } from '../../systems/powerups.js'
import PowerupOffer from '../../../components/hud/PowerupOffer.jsx'
import { tuneParams } from './tuning.js'
import Joystick from '../../../components/hud/Joystick.jsx'
import { useSettings } from '../../store/settings.js'
import { showRewardedAd } from '../../services/adService.js'

// Runs one arcade mini-game (games/*.js) full screen over the frozen street:
// the how-to-play intro (in full the first time, then your best score), the
// game loop (stops while the game is paused), a score bar at the top, a pad
// of buttons at the bottom when the game has them, keys on a keyboard, and
// the result with "Try again". Every game is one mode in the story JSON:
//   { "type": "startMode", "mode": "draughts", "params": { ... }, "results": { "won": ..., "lost": ... } }

export function makeArcadeMode(game) {
  function ArcadeMode({ params: given = {}, onFinish }) {
    const canvasRef = useRef()
    // games that show you get your look as params.you
    const you = useGameStore((s) => s.game?.player?.look)
    const params = useMemo(() => ({ ...given, you: given.you || you || null }), []) // eslint-disable-line react-hooks/exhaustive-deps
    // harder as the story goes on (0 = the first chapter, 1 = the last)
    // ... and the more you've played this game (records.js: practice), which also pays more
    const storyAt = useMemo(() => given.level ?? storyLevel(useGameStore.getState().game, storyCtx.chapters), []) // eslint-disable-line react-hooks/exhaustive-deps
    const level = useMemo(() => Math.min(1, storyAt + practiceBump(game.id)), [storyAt])
    const rewardMul = useMemo(() => rewardMulFor(game.id, storyAt), [storyAt])
    const seed = useMemo(() => params.seed ?? Math.floor(Math.random() * 99999), []) // eslint-disable-line react-hooks/exhaustive-deps
    const [round, setRound] = useState(0) // "Try again" starts a new round
    // the run's settings: what the story asked, tuned to the story level and the power-ups bought on the start screen
    const state = useMemo(() => game.create({ ...tuneParams(game.id, params, level, usePowerups.getState().active), rewardMul }, seed + round * 101), [round]) // eslint-disable-line react-hooks/exhaustive-deps
    const [stage, setStage] = useState('intro') // intro | play | done
    const [hud, setHud] = useState(() => game.hud?.(state) || [])
    const [buttons, setButtons] = useState(() => game.buttons?.(state) || [])
    const firstTime = useState(() => !seenIntro(game.id))[0]
    // moving games: the analog stick or the arrow buttons (Settings → Controls)
    const stickChosen = useSettings((s) => (s.moveControl || 'stick') === 'stick')
    const useStick = Boolean(game.stick) && stickChosen
    // watch ads after a paying game: one doubles the money, a second triples it
    const [adMul, setAdMul] = useState(1)
    const [adBusy, setAdBusy] = useState(false)
    const best = useState(() => bestScore(game.id))[0]
    const live = useRef({ stage, state })
    live.current = { stage, state }

    useEffect(() => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      let v = viewFor(1, 1)
      let W = 1
      let H = 1
      // the score bar on top and the button pad at the bottom get their own bands:
      // the game draws in between, so nothing important hides under them
      const band = { top: 0, bottom: 0 }
      const measure = () => {
        const hudEl = document.querySelector('.arcade-hud')
        const padEl = document.querySelector('.arcade-pad')
        const top = Math.max(52, hudEl ? Math.round(hudEl.getBoundingClientRect().bottom) + 6 : 52)
        const bottom = padEl && padEl.children.length ? Math.round(H - padEl.getBoundingClientRect().top) + 6 : 8
        if (top !== band.top || bottom !== band.bottom) {
          band.top = top
          band.bottom = bottom
          v = viewFor(W, Math.max(80, H - top - bottom))
        }
      }
      const layout = () => {
        const r = canvas.getBoundingClientRect()
        W = Math.max(1, Math.round(r.width))
        H = Math.max(1, Math.round(r.height))
        canvas.width = W
        canvas.height = H
        band.top = -1
        measure()
      }
      layout()
      window.addEventListener('resize', layout)
      // the canvas can change size without a window resize (fullscreen, the page settling after loading)
      const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null
      watch?.observe(canvas)
      let failed = false // a drawing error shows once in the console and the game keeps going
      let raf = 0
      let last = performance.now()
      let t = 0
      let hudT = 0
      let ended = false
      const frame = (now) => {
        raf = requestAnimationFrame(frame)
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
        last = now
        const { stage: st, state: s } = live.current
        const running = st === 'play' && !s.over && !isPaused()
        if (running) {
          t += dt
          try {
            game.step(s, dt)
          } catch (err) {
            if (!failed) console.error(`[${game.id}] step`, err)
            failed = true
          }
          if (s.sound) {
            for (const name of s.sound) sfx(name)
            s.sound.length = 0
          }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#14112a'
        ctx.fillRect(0, 0, W, H)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, band.top, W, v.H)
        ctx.clip()
        ctx.translate(0, band.top)
        try {
          game.draw(ctx, s, v, t)
        } catch (err) {
          if (!failed) console.error(`[${game.id}] draw`, err)
          failed = true
        }
        ctx.restore()
        hudT -= dt
        if (hudT <= 0) {
          hudT = 0.1
          measure()
          setHud(game.hud?.(s) || [])
          setButtons(game.buttons?.(s) || [])
        }
        if (st === 'play' && s.over && !ended) {
          ended = true
          const res = game.result(s, params)
          sfx(res.outcome === (game.winOutcome || 'won') ? 'win' : 'lose')
          setTimeout(() => setStage('done'), 700)
        }
        if (st !== 'play') ended = false
      }
      raf = requestAnimationFrame(frame)
      const point = (type) => (e) => {
        const { stage: st, state: s } = live.current
        if (st !== 'play' || s.over || isPaused()) return
        const r = canvas.getBoundingClientRect()
        if (type === 'down') canvas.setPointerCapture?.(e.pointerId)
        game.input(s, { type, x: e.clientX - r.left, y: e.clientY - r.top - band.top }, v)
        e.preventDefault()
      }
      const down = point('down')
      const move = point('move')
      const up = point('up')
      canvas.addEventListener('pointerdown', down)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', up)
      // held buttons (walking left and right) send down and up; the others just a press
      const holds = new Set(game.holdIds || [])
      const onKey = (e) => {
        const { stage: st, state: s } = live.current
        if (st !== 'play' || s.over || isPaused()) return
        const id = game.keys?.[e.code]
        if (id != null) {
          e.preventDefault()
          if (holds.has(id) && e.repeat) return
          game.input(s, { type: 'button', id, down: true }, v)
        } else if (game.onKey) game.input(s, { type: 'key', code: e.code }, v)
      }
      const onKeyUp = (e) => {
        const id = game.keys?.[e.code]
        if (id != null && holds.has(id)) game.input(live.current.state, { type: 'button', id, down: false }, v)
      }
      const releaseAll = () => {
        for (const id of holds) game.input(live.current.state, { type: 'button', id, down: false }, v)
      }
      window.addEventListener('keydown', onKey)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('blur', releaseAll)
      if (import.meta.env.DEV) window.__arcade = { game, live }
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', layout)
        watch?.disconnect()
        window.removeEventListener('keydown', onKey)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('blur', releaseAll)
        canvas.removeEventListener('pointerdown', down)
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', up)
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one loop for the mode's life; it reads live state through refs

    const press = (id, down = true) => {
      const s = live.current.state
      if (down && (live.current.stage !== 'play' || s.over || isPaused())) return
      game.input(s, { type: 'button', id, down }, viewFor(1, 1))
      setButtons(game.buttons?.(s) || [])
    }
    const padButton = (b) => (
      <button
        key={b.id}
        data-tut={b.id}
        className={`arcade-btn ${b.on ? 'on' : ''} ${b.big ? 'big' : ''}`}
        style={b.color ? { background: b.color } : undefined}
        disabled={b.disabled}
        onPointerDown={(e) => {
          e.preventDefault()
          if (b.hold) e.currentTarget.setPointerCapture?.(e.pointerId)
          press(b.id, true)
        }}
        onPointerUp={b.hold ? () => press(b.id, false) : undefined}
        onPointerCancel={b.hold ? () => press(b.id, false) : undefined}
        onLostPointerCapture={b.hold ? () => press(b.id, false) : undefined}
      >
        {b.key && <small>{b.key}</small>}
        {b.label}
      </button>
    )

    // the result, its money scaled by the reward multiplier (games that pay per
    // thing, like the escape's bounty, scale it themselves: scalesReward)
    const raw = stage === 'done' ? game.result(state, params) : null
    const res = raw && raw.moneyChange > 0 && !game.scalesReward ? { ...raw, moneyChange: Math.round((raw.moneyChange * rewardMul) / 10) * 10 } : raw
    useEffect(() => {
      if (!res) return
      recordScore(game.id, res.score || 0)
      recordPlay(game.id, res.outcome === (game.winOutcome || 'won'))
    }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

    const host = typeof document !== 'undefined' ? document.querySelector('.story-screen') : null
    const board = <canvas ref={canvasRef} className="fight2d-canvas arcade-canvas" aria-label={game.title} />
    const title = typeof game.title === 'function' ? game.title(params) : game.title
    return (
      <>
        {host ? createPortal(board, host) : board}
        {stage === 'intro' && (
          <div className="fee-intro arcade-intro">
            <h2>{title}</h2>
            {firstTime ? (
              <ul>
                {(typeof game.rules === 'function' ? game.rules(params) : game.rules).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p>{typeof game.short === 'function' ? game.short(params) : game.short}</p>
            )}
            {best > 0 && (
              <p className="fight-record">
                Your best: <strong>{best}</strong> {game.scoreLabel || 'points'}
              </p>
            )}
            {params.prize ? <p>Prize: {formatNaira(params.prize)}</p> : null}
            <p className="arcade-level" title="Rises as the story goes on, and the more you play">
              Difficulty <strong>{'★'.repeat(1 + Math.round(level * 4))}{'☆'.repeat(4 - Math.round(level * 4))}</strong>
              {rewardMul > 1 && !given.recreational && <span className="arcade-mul"> · rewards ×{rewardMul}</span>}
            </p>
            <PowerupOffer mode={game.id} />
            <button
              className="btn btn-primary"
              onClick={() => {
                markIntroSeen(game.id)
                setRound((n) => n + 1) // build the run now, with any power-ups just bought
                setStage('play')
              }}
            >
              {game.start || 'Start'}
            </button>
          </div>
        )}
        {stage === 'play' && (
          <>
            {hud.length > 0 && (
              <div className="arcade-hud">
                {hud.map((h) => (
                  <span key={h.label} className={h.warn ? 'warn' : ''}>
                    <small>{h.label}</small> {h.value}
                  </span>
                ))}
              </div>
            )}
            {buttons.length > 0 &&
              (buttons.some((b) => b.side) ? (
                <div className="arcade-pad split">
                  <div className="pad-side">
                    {useStick && <Joystick className="arcade-stick" onMove={(x, y) => !isPaused() && game.input(live.current.state, { type: 'stick', x, y }, viewFor(1, 1))} />}
                    {buttons.filter((b) => b.side === 'left' && !(useStick && b.move)).map(padButton)}
                  </div>
                  <div className="pad-side">{buttons.filter((b) => b.side !== 'left').map(padButton)}</div>
                </div>
              ) : (
                <div className="arcade-pad">{buttons.map(padButton)}</div>
              ))}
          </>
        )}
        {res && (
          <div className="fee-intro arcade-result">
            <h2>{res.headline || (res.outcome === (game.winOutcome || 'won') ? 'You did it!' : 'Not this time.')}</h2>
            {res.line && <p>{res.line}</p>}
            <p>
              {game.scoreLabel ? `${res.score} ${game.scoreLabel}` : `Score ${res.score}`}
              {res.score >= best && res.score > 0 ? ' · new best!' : best > 0 ? ` · best ${Math.max(best, res.score)}` : ''}
            </p>
            {res.moneyChange && !given.recreational ? (
              <p className="arcade-pay">
                {res.moneyChange > 0 ? `+${formatNaira(res.moneyChange * adMul)}` : `−${formatNaira(-res.moneyChange)}`}
                {adMul > 1 && <strong> ×{adMul}</strong>}
              </p>
            ) : null}
            {res.moneyChange > 0 && adMul < 3 && !given.recreational && (
              <button
                className="btn btn-ad"
                disabled={adBusy}
                onClick={async () => {
                  setAdBusy(true)
                  if (await showRewardedAd(`reward:${game.id}`)) setAdMul((m) => m + 1)
                  setAdBusy(false)
                }}
              >
                ▶ Watch an ad: {adMul === 1 ? 'double it' : 'triple it'} ({formatNaira(res.moneyChange * (adMul + 1))})
              </button>
            )}
            <div className="result-actions">
              <button className="btn btn-primary" disabled={adBusy} onClick={() => onFinish(adMul > 1 ? { ...res, moneyChange: res.moneyChange * adMul } : res)}>
                Continue
              </button>
              {res.outcome !== (game.winOutcome || 'won') && (
                <button
                  className="btn"
                  onClick={() => {
                    setRound((n) => n + 1)
                    setAdMul(1)
                    setStage('play')
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
      </>
    )
  }
  ArcadeMode.displayName = `Arcade(${game.id})`
  return ArcadeMode
}
