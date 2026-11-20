import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { viewFor } from './px.js'
import { isPaused } from '../../store/pauseStore.js'
import { sfx } from '../../audio/audio.js'
import { formatNaira } from '../../narrative/stats.js'
import { seenIntro, markIntroSeen, bestScore, recordScore } from '../../systems/records.js'
import { useGameStore } from '../../store/gameStore.js'

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
    const seed = useMemo(() => params.seed ?? Math.floor(Math.random() * 99999), []) // eslint-disable-line react-hooks/exhaustive-deps
    const [round, setRound] = useState(0) // "Try again" starts a new round
    const state = useMemo(() => game.create(params, seed + round * 101), [round]) // eslint-disable-line react-hooks/exhaustive-deps
    const [stage, setStage] = useState('intro') // intro | play | done
    const [hud, setHud] = useState(() => game.hud?.(state) || [])
    const [buttons, setButtons] = useState(() => game.buttons?.(state) || [])
    const firstTime = useState(() => !seenIntro(game.id))[0]
    const best = useState(() => bestScore(game.id))[0]
    const live = useRef({ stage, state })
    live.current = { stage, state }

    useEffect(() => {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      let v = viewFor(1, 1)
      const layout = () => {
        const r = canvas.getBoundingClientRect()
        const W = Math.max(1, Math.round(r.width))
        const H = Math.max(1, Math.round(r.height))
        canvas.width = W
        canvas.height = H
        v = viewFor(W, H)
      }
      layout()
      window.addEventListener('resize', layout)
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
          game.step(s, dt)
          if (s.sound) {
            for (const name of s.sound) sfx(name)
            s.sound.length = 0
          }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, v.W, v.H)
        game.draw(ctx, s, v, t)
        hudT -= dt
        if (hudT <= 0) {
          hudT = 0.1
          setHud(game.hud?.(s) || [])
          setButtons(game.buttons?.(s) || [])
        }
        if (st === 'play' && s.over && !ended) {
          ended = true
          const res = game.result(s, params)
          sfx(res.outcome === 'won' ? 'win' : 'lose')
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
        game.input(s, { type, x: e.clientX - r.left, y: e.clientY - r.top }, v)
        e.preventDefault()
      }
      const down = point('down')
      const move = point('move')
      const up = point('up')
      canvas.addEventListener('pointerdown', down)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', up)
      const onKey = (e) => {
        const { stage: st, state: s } = live.current
        if (st !== 'play' || s.over || isPaused()) return
        const id = game.keys?.[e.code]
        if (id != null) {
          game.input(s, { type: 'button', id }, v)
          e.preventDefault()
        } else if (game.onKey) game.input(s, { type: 'key', code: e.code }, v)
      }
      window.addEventListener('keydown', onKey)
      if (import.meta.env.DEV) window.__arcade = { game, live }
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', layout)
        window.removeEventListener('keydown', onKey)
        canvas.removeEventListener('pointerdown', down)
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', up)
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one loop for the mode's life; it reads live state through refs

    const press = (id) => {
      const s = live.current.state
      if (live.current.stage !== 'play' || s.over || isPaused()) return
      game.input(s, { type: 'button', id }, viewFor(1, 1))
      setButtons(game.buttons?.(s) || [])
    }

    const res = stage === 'done' ? game.result(state, params) : null
    useEffect(() => {
      if (res) recordScore(game.id, res.score || 0)
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
            <button
              className="btn btn-primary"
              onClick={() => {
                markIntroSeen(game.id)
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
            {buttons.length > 0 && (
              <div className="arcade-pad">
                {buttons.map((b) => (
                  <button
                    key={b.id}
                    className={`arcade-btn ${b.on ? 'on' : ''}`}
                    style={b.color ? { background: b.color } : undefined}
                    disabled={b.disabled}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      press(b.id)
                    }}
                  >
                    {b.key && <small>{b.key}</small>}
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {res && (
          <div className="fee-intro arcade-result">
            <h2>{res.headline || (res.outcome === 'won' ? 'You did it!' : 'Not this time.')}</h2>
            {res.line && <p>{res.line}</p>}
            <p>
              {game.scoreLabel ? `${res.score} ${game.scoreLabel}` : `Score ${res.score}`}
              {res.score >= best && res.score > 0 ? ' · new best!' : best > 0 ? ` · best ${Math.max(best, res.score)}` : ''}
            </p>
            {res.moneyChange ? <p>{res.moneyChange > 0 ? `+${formatNaira(res.moneyChange)}` : `−${formatNaira(-res.moneyChange)}`}</p> : null}
            <div className="result-actions">
              <button className="btn btn-primary" onClick={() => onFinish(res)}>
                Continue
              </button>
              {res.outcome !== 'won' && (
                <button
                  className="btn"
                  onClick={() => {
                    setRound((n) => n + 1)
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
