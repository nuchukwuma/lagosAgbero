import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFight, fightInput, opponentProfile } from './fightStore.js'
import { createFight, stepFight, MOVES } from './fightLogic.js'
import { makeFighter, poseFor, drawFighter, mix, POSES } from './fight2d/puppet.js'
import { makeStage } from './fight2d/stage.js'
import { useGameStore } from '../../store/gameStore.js'
import { useSettings, effectiveQuality, canvasRatio } from '../../store/settings.js'
import { isPaused } from '../../store/pauseStore.js'
import { randomLook, withAllegiance } from '../../characters/look.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'
import { has } from '../../systems/powerups.js'

// A street fight as a 2D fighting game: side-on, two hand-drawn fighters
// (fight2d/puppet.js) on a painted Lagos street (fight2d/stage.js), the
// camera sliding and easing out to keep both in shot. The rules are the same
// as before (fightLogic.js); this draws them and adds the feel: hit sparks,
// comic words, a split-second freeze on every blow, screen shake, a flash and
// a slow-motion knock-out.
//
// Sharp on any screen: everything is drawn as shapes at the phone's own pixel
// density, capped on budget phones (Light mode) so 2 GB phones keep a steady
// frame rate. The 3D street is switched off while the fight is on.

const STUN = 0.38 // fightLogic's stun time (for the hit pose)
const HIT_STOP = { punch: 0.06, kick: 0.09, special: 0.16 }
const WORDS = {
  punch: ['GBAM!', 'KPA!', 'POW!', 'WHAM!'],
  kick: ['KPAU!', 'BOOM!', 'GBOSA!', 'WHUMP!'],
  special: ['LAGOS ROUNDABOUT!', 'KPAKPAKPA!', 'GBAGAUN!'],
  block: ['BLOCK!', 'TCHK!'],
  air: ['FLYING KICK!', 'GBOSA!', 'WHOOSH-KPA!'],
}
const PAN = 4.5 // metres the camera can slide either way

const pixelRatio = () => canvasRatio(useSettings.getState().quality)

function starPath(ctx, x, y, r, points = 8, inner = 0.45) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}

const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t))

/** A gold naira coin, spinning (squashed sideways as it turns). */
function drawCoin(ctx, x, y, r, spin) {
  const sx = Math.max(0.15, Math.abs(Math.cos(spin)))
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sx, 1)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = '#b8860b'
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.18)
  ctx.strokeStyle = '#3a2405'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-r * 0.06, -r * 0.06, r * 0.78, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd23a'
  ctx.fill()
  if (sx > 0.5) {
    ctx.fillStyle = '#9a6a00'
    ctx.font = `900 ${Math.round(r * 1.1)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('₦', 0, r * 0.05)
  }
  ctx.restore()
}

export default function Fight2D({ params }) {
  const canvasRef = useRef()
  const game = useGameStore((s) => s.game)
  const time = useGameStore((s) => s.view?.time || 'day')
  const profile = opponentProfile(params.opponent)
  const fighters = useMemo(() => {
    const base = profile.character ? characters[profile.character]?.look : randomLook(profile.seed || 5, 'male')
    const player = withAllegiance(game?.player.look || {}, game?.flags || {})
    return { p: makeFighter(player), o: makeFighter({ ...base, ...(profile.lookOverride || {}) }) }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps
  // the HUD draws the same fighters in its round portrait badges
  useEffect(() => useFight.setState({ looks: fighters }), [fighters])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const stats = useGameStore.getState().game?.stats
    const fight = createFight(profile, { energy: stats?.energy ?? 70, notoriety: stats?.notoriety ?? 0, difficulty: params.difficulty ?? 1 })
    const light = effectiveQuality(useSettings.getState().quality) === 'low'
    let W = 0
    let H = 0
    let dpr = 1
    let ppm = 100
    let groundY = 0
    let stage = null
    const layout = () => {
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, rect.width)
      H = Math.max(1, rect.height)
      dpr = pixelRatio()
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      const portrait = H > W
      groundY = H * (portrait ? 0.7 : 0.9)
      // as big as fits: both fighters across, heads clear of the health bars
      const top = portrait ? 150 : 112
      ppm = Math.min(W / (portrait ? 4.6 : 7.2), (groundY - top) / 1.75)
      stage = makeStage({ W, H, ppm, groundY, pan: PAN + 2, time, dpr, light, seed: (params.opponent || 'x').length * 31 + 7 })
    }
    layout()
    window.addEventListener('resize', layout)

    // per fighter: the drawn pose (eased towards the rules' pose), squash, afterimages
    const look = {
      p: { pose: mix(POSES.stance, POSES.stance, 0), squash: 0, ghosts: [], ghostT: 0 },
      o: { pose: mix(POSES.stance, POSES.stance, 0), squash: 0, ghosts: [], ghostT: 0 },
    }
    const fx = { sparks: [], bursts: [], words: [], coins: [], shake: 0, flash: 0, hitStop: 0, slow: 0, banner: null, cheer: 0.2 }
    let camX = 0
    let zoom = 1
    let t = 0
    let overT = 0
    let endAt = 0
    let started = false
    let last = performance.now()
    let raf = 0
    let drawnAt = 0
    let hudTimer = 0

    const toScreen = (x, y) => [W / 2 + (x - camX) * ppm, groundY - y * ppm]

    function impact(kind, attacker, victim, who) {
      const dir = who === 'player' ? 1 : -1
      const x = victim.x - dir * 0.2
      // the cartoon fighters are shorter: head about 1.2 m, chest about 0.85 m
      const y = victim.y + (kind === 'kick' ? 0.8 : kind === 'block' ? 1.0 : kind === 'air' ? 1.05 : 1.18)
      const st = { punch: ['#fff3b0', '#ffb020', 0.36], kick: ['#ffe08a', '#ff7a1a', 0.48], air: ['#ffe08a', '#ff7a1a', 0.5], special: ['#ffffff', '#ff3d2e', 0.8], block: ['#d8f1ff', '#5aa9ff', 0.28] }[kind]
      fx.bursts.push({ x, y, t: 0, color: st[0], ring: st[1], size: st[2] })
      for (let i = 0; i < (light ? 6 : 12); i++) {
        const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.2
        const v = 2.5 + Math.random() * 4
        fx.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1.5, life: 0.3 + Math.random() * 0.2, t: 0, color: Math.random() < 0.5 ? st[0] : st[1] })
      }
      const words = WORDS[kind]
      fx.words.push({ text: words[Math.floor(Math.random() * words.length)], x, y: y + 0.35, t: 0, rot: (Math.random() - 0.5) * 0.4, kind })
      if (fx.words.length > 3) fx.words.shift()
      if (kind !== 'block') {
        fx.hitStop = HIT_STOP[kind] || 0.06
        look[who === 'player' ? 'o' : 'p'].squash = 0.16
        fx.shake = kind === 'special' ? 14 : kind === 'kick' || kind === 'air' ? 8 : 5
        fx.cheer = Math.min(1, fx.cheer + (kind === 'special' ? 0.6 : 0.25))
        if (kind === 'special' || (kind === 'kick' && Math.random() < 0.5)) sfx('crowd') // the crowd roars at the big ones
        if (kind === 'special') fx.flash = 0.18
        // a drop of sweat flies off
        fx.sparks.push({ x: victim.x, y: victim.y + 1.4, vx: -dir * -1.5, vy: 2.5, life: 0.5, t: 0, color: '#bfe6ff', drop: true })
      }
    }

    function step(dt) {
      const store = useFight.getState()
      if (!started && store.started) {
        started = true
        fight.mods = { dealt: has('heavyHands') ? 1.3 : 1, taken: has('ironJaw') ? 0.65 : 1 }
        if (has('fullMeter')) fight.p.special = 100
        fx.banner = { text: 'FIGHT!', t: 0 }
        sfx('whistle')
      }
      if (fx.hitStop > 0) {
        fx.hitStop -= dt
        return
      }
      const simDt = fight.over ? dt * (overT < 0.8 ? 0.35 : 1) : dt // slow-motion knock-out
      t += simDt
      if (started && !store.ended && !fight.over) {
        const before = { p: fight.p.hp, o: fight.o.hp }
        stepFight(fight, { ...fightInput }, simDt)
        fightInput.punch = fightInput.kick = fightInput.special = fightInput.dodge = fightInput.jump = false
        for (const ev of fight.events) {
          const attacker = ev.who === 'player' ? fight.p : fight.o
          const victim = ev.who === 'player' ? fight.o : fight.p
          if (ev.type === 'hit' || ev.type === 'blocked') impact(ev.type === 'blocked' ? 'block' : ev.move, attacker, victim, ev.who)
          if (ev.recoil) fx.words.push({ text: 'OPEN!', x: attacker.x, y: attacker.y + 1.7, t: 0, rot: 0, kind: 'block' })
          // the crowd throws money: coins spin up off the opponent and fly to the purse
          for (let i = 0; i < (ev.coins || 0); i++) fx.coins.push({ x: victim.x, y: victim.y + 1.2, vx: (Math.random() - 0.3) * 2.5, vy: 3 + Math.random() * 2, t: -i * 0.08, spin: Math.random() * 6 })
          if (ev.coins) setTimeout(() => sfx('coin'), 350)
          if (ev.type === 'jumped') {
            sfx('whoosh')
            fx.words.push({ text: 'OVER!', x: victim.x, y: victim.y + 1.6, t: 0, rot: 0.1, kind: 'block' })
          }
          if (ev.type === 'dodged' || ev.type === 'jumped') sfx('whoosh')
          else if (ev.type === 'blocked') sfx('block')
          else if (ev.move === 'special') sfx('special')
          else if (ev.who === 'player') sfx(ev.move === 'kick' ? 'kick' : 'punch')
          else sfx('hurt')
        }
        const taken = before.p - fight.p.hp
        const dealt = before.o - fight.o.hp
        if (taken || dealt) useFight.setState({ stats: { dealt: store.stats.dealt + dealt, taken: store.stats.taken + taken } })
        if (fight.coins !== store.coins) setTimeout(() => useFight.setState({ coins: fight.coins }), 650) // when they land in the purse
        hudTimer -= dt
        if (hudTimer <= 0 || taken || dealt) {
          hudTimer = 0.1
          useFight.setState({ hud: { php: fight.p.hp, pmax: fight.p.maxHp, ohp: fight.o.hp, omax: fight.o.maxHp, special: fight.p.special, name: profile.name, combo: fight.p.combo } })
        }
        if (fight.over) {
          sfx('ko')
          fx.shake = 16
          fx.banner = { text: 'K.O.!', t: 0 }
          fx.cheer = 1
          setTimeout(() => sfx(fight.over === 'won' ? 'win' : 'lose'), 900)
          endAt = performance.now() + 2000
        }
      }
      if (fight.over) {
        overT += simDt
        if (overT > 0.5 && overT - simDt <= 0.5) fx.sparks.push(...dustPuff(fight.over === 'won' ? fight.o.x : fight.p.x))
        if (endAt && performance.now() > endAt) {
          endAt = 0
          useFight.getState().end(fight.over)
        }
      }
      // poses
      for (const k of ['p', 'o']) {
        const f = fight[k]
        const target = poseFor(f, MOVES, { over: fight.over, winner: (k === 'p') === (fight.over === 'won'), t: t + (k === 'o' ? 0.4 : 0), overT, stunMax: STUN })
        const L = look[k]
        L.pose = f.action || fight.over ? target : mix(L.pose, target, 1 - Math.exp(-dt * 24))
        L.squash = Math.max(0, L.squash - dt)
        // afterimages while dodging or spinning
        L.ghostT -= dt
        const trail = f.dodgeT > 0 || f.action?.type === 'special' || f.action?.type === 'air' || f.action?.type === 'air'
        if (trail && L.ghostT <= 0) {
          L.ghostT = 0.035
          L.ghosts.push({ pose: L.pose, x: f.x, y: f.y, life: 0.22 })
          if (L.ghosts.length > (light ? 2 : 4)) L.ghosts.shift()
        }
        for (const g of L.ghosts) g.life -= dt
        L.ghosts = L.ghosts.filter((g) => g.life > 0)
      }
      // camera: follow the middle, ease out when they're far apart
      const mid = (fight.p.x + fight.o.x) / 2
      camX += (Math.max(-PAN, Math.min(PAN, mid)) - camX) * (1 - Math.exp(-dt * 5))
      const gap = fight.o.x - fight.p.x
      const want = Math.max(0.78, Math.min(1, W / ppm / (gap + 3.0)))
      zoom += (want - zoom) * (1 - Math.exp(-dt * 3))
      // effects
      for (const s of fx.sparks) {
        s.t += dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vy -= 9 * dt
      }
      fx.sparks = fx.sparks.filter((s) => s.t < s.life)
      for (const c of fx.coins) {
        c.t += dt
        if (c.t > 0 && c.t < 0.35) {
          c.x += c.vx * dt
          c.y += c.vy * dt
          c.vy -= 9 * dt
        }
      }
      fx.coins = fx.coins.filter((c) => c.t < 0.75)
      for (const b of fx.bursts) b.t += dt
      fx.bursts = fx.bursts.filter((b) => b.t < 0.3)
      for (const w of fx.words) w.t += dt
      fx.words = fx.words.filter((w) => w.t < 0.75)
      fx.shake = Math.max(0, fx.shake - dt * 60)
      fx.flash = Math.max(0, fx.flash - dt)
      fx.cheer = Math.max(0.15, fx.cheer - dt * 0.25)
      if (fx.banner) {
        fx.banner.t += dt
        if (fx.banner.t > 1.3) fx.banner = null
      }
    }

    function dustPuff(x) {
      return Array.from({ length: light ? 5 : 10 }, (_, i) => ({ x: x - 0.6 + (i / 10) * 1.2, y: 0.05, vx: (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), life: 0.6, t: 0, color: 'rgba(200,185,160,0.8)', dust: true }))
    }

    // the lunge carries a blow to its target, but never through the other fighter
    const lunge = (pose) => {
      const room = Math.max(0.08, fight.o.x - fight.p.x - 1.0)
      return pose.dx > room ? { ...pose, dx: room } : pose
    }

    function drawPuppet(k, f, facing, alpha = 1, pose0 = look[k].pose, x = f.x, y = f.y) {
      const L = look[k]
      const pose = lunge(pose0)
      const [sx, sy] = toScreen(x, y)
      const sq = alpha === 1 && L.squash > 0 ? Math.sin((L.squash / 0.16) * Math.PI) * 0.16 : 0
      ctx.save()
      ctx.translate(sx, sy)
      ctx.scale(ppm * facing * (1 + sq), -ppm * (1 - sq))
      drawFighter(ctx, fighters[k], pose, { alpha })
      ctx.restore()
    }

    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const shx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0
      const shy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0
      ctx.save()
      // zoom about the fighters' feet in the middle of the screen
      ctx.translate(W / 2 + shx, groundY + shy)
      ctx.scale(zoom, zoom)
      ctx.translate(-W / 2, -groundY)
      if (stage) stage.draw(ctx, camX, t, fx.cheer)
      // shadows on the road
      for (const k of ['p', 'o']) {
        const f = fight[k]
        const [sx] = toScreen(f.x + (lunge(look[k].pose).dx || 0) * (k === 'p' ? 1 : -1), 0) // follows the lunge
        const lift = Math.max(0.35, 1 - f.y * 0.5) // smaller under a jumper
        ctx.fillStyle = `rgba(0,0,0,${0.36 * lift})`
        ctx.beginPath()
        ctx.ellipse(sx, groundY + 2, ppm * 0.48 * lift, ppm * 0.09 * lift, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      // the attacker in front, so the blow lands over the other one
      const order = fight.o.action && !fight.p.action ? ['p', 'o'] : ['o', 'p']
      for (const k of order) {
        const f = fight[k]
        const facing = k === 'p' ? 1 : -1
        look[k].ghosts.forEach((g, i) => drawPuppet(k, f, facing, 0.12 + i * 0.05, g.pose, g.x, g.y))
        drawPuppet(k, f, facing)
      }
      // hit bursts: a star of light and a ring
      for (const b of fx.bursts) {
        const [x, y] = toScreen(b.x, b.y)
        const k = b.t / 0.3
        const r = b.size * ppm * (0.5 + Math.min(1, k * 4) * 0.7)
        ctx.globalAlpha = 1 - k
        ctx.lineWidth = Math.max(2, ppm * 0.05)
        ctx.strokeStyle = b.ring
        ctx.beginPath()
        ctx.arc(x, y, r * (0.6 + k * 1.2), 0, Math.PI * 2)
        ctx.stroke()
        starPath(ctx, x, y, r, 8, 0.42)
        ctx.fillStyle = b.ring
        ctx.fill()
        starPath(ctx, x, y, r * 0.66, 8, 0.45)
        ctx.fillStyle = b.color
        ctx.fill()
        ctx.globalAlpha = 1
      }
      // sparks, sweat, dust
      for (const s of fx.sparks) {
        const [x, y] = toScreen(s.x, s.y)
        const k = 1 - s.t / s.life
        ctx.globalAlpha = k
        if (s.dust) {
          ctx.fillStyle = s.color
          ctx.beginPath()
          ctx.arc(x, y, ppm * (0.08 + (1 - k) * 0.15), 0, Math.PI * 2)
          ctx.fill()
        } else if (s.drop) {
          ctx.fillStyle = s.color
          ctx.beginPath()
          ctx.ellipse(x, y, ppm * 0.025, ppm * 0.04, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = s.color
          ctx.lineWidth = Math.max(1.5, ppm * 0.025)
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - s.vx * ppm * 0.03, y + s.vy * ppm * 0.03)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      ctx.restore()
      // comic words (not zoomed: always readable)
      for (const w of fx.words) {
        const [x, y] = toScreen(w.x, w.y)
        const k = w.t / 0.75
        const pop = k < 0.2 ? 0.5 + (k / 0.2) * 0.75 : 1.25 - Math.min(0.25, (k - 0.2) * 0.6)
        const size = Math.max(18, ppm * (w.kind === 'special' ? 0.36 : w.kind === 'kick' ? 0.3 : w.kind === 'block' ? 0.2 : 0.26))
        ctx.save()
        ctx.translate(W / 2 + (x - W / 2) * zoom, groundY + (y - groundY) * zoom - k * ppm * 0.3)
        ctx.rotate(w.rot)
        ctx.scale(pop, pop)
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
        ctx.font = `italic 900 ${Math.round(size)}px Impact, 'Arial Black', system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        const [fill, stroke] = w.kind === 'special' ? ['#ffffff', '#b3200f'] : w.kind === 'block' ? ['#bfe3ff', '#163a63'] : w.kind === 'kick' ? ['#ff9a2e', '#2a1408'] : ['#ffd23a', '#2a1408']
        ctx.lineWidth = size * 0.2
        ctx.strokeStyle = stroke
        ctx.strokeText(w.text, 3, 3)
        ctx.strokeText(w.text, 0, 0)
        ctx.fillStyle = fill
        ctx.fillText(w.text, 0, 0)
        ctx.restore()
      }
      // coins: up off the opponent, then a swoop to the purse (top left)
      for (const c of fx.coins) {
        if (c.t < 0) continue
        let [x, y] = toScreen(c.x, c.y)
        x = W / 2 + (x - W / 2) * zoom
        y = groundY + (y - groundY) * zoom
        if (c.t > 0.35) {
          const k = ease((c.t - 0.35) / 0.4)
          x += (40 - x) * k // the purse, top left
          y += (30 - y) * k
        }
        drawCoin(ctx, x, y, Math.max(9, ppm * 0.13) * (c.t > 0.35 ? 1 - (c.t - 0.35) * 0.9 : 1), c.spin + c.t * 14)
      }
      // banners: FIGHT! / K.O.!
      if (fx.banner) {
        const k = fx.banner.t / 1.3
        const size = Math.min(W * 0.16, H * 0.2)
        const s = k < 0.15 ? 2.2 - (k / 0.15) * 1.2 : 1
        ctx.save()
        ctx.translate(W / 2, H * 0.42)
        ctx.scale(s, s)
        ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1
        ctx.font = `italic 900 ${Math.round(size)}px Impact, 'Arial Black', system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.lineWidth = size * 0.16
        ctx.strokeStyle = '#2a1408'
        ctx.strokeText(fx.banner.text, 4, 4)
        ctx.strokeText(fx.banner.text, 0, 0)
        ctx.fillStyle = fx.banner.text === 'K.O.!' ? '#ff4b2b' : '#ffd23a'
        ctx.fillText(fx.banner.text, 0, 0)
        ctx.restore()
      }
      if (fx.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(fx.flash / 0.18) * 0.7})`
        ctx.fillRect(0, 0, W, H)
      }
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!isPaused()) step(dt) // paused: the picture holds
      // Light mode (budget phones): draw at most 30 times a second, like the 3D street
      if (light && now - drawnAt < 30) return
      drawnAt = now
      render()
    }
    raf = requestAnimationFrame(frame)
    if (import.meta.env.DEV) window.__fight2d = { fight, fx }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', layout)
    }
  }, [fighters]) // eslint-disable-line react-hooks/exhaustive-deps

  // drawn over the (paused) 3D street, under the game's top bar and buttons
  const host = typeof document !== 'undefined' ? document.querySelector('.story-screen') : null
  const el = <canvas ref={canvasRef} className="fight2d-canvas" aria-label="Street fight" />
  return host ? createPortal(el, host) : el
}
