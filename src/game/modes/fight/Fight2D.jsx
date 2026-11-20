import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFight, fightInput, opponentProfile } from './fightStore.js'
import { createFight, stepFight, MOVES, ARENA, itemNear } from './fightLogic.js'
import { storyLevel } from '../../systems/progress.js'
import { storyCtx } from '../../narrative/storyData.js'
import { makePixelFighter, frameFor, flashOf, tintOf, reachOf, M_PER_PX, CW, CH, AX, AY } from './fight2d/pixel.js'
import { makePixelStage, backdropFor } from './fight2d/pixelStage.js'
import { useGameStore } from '../../store/gameStore.js'
import { useSettings, effectiveQuality } from '../../store/settings.js'
import { placeHere } from './fight2d/where.js'
import { isPaused, usePause } from '../../store/pauseStore.js'
import { randomLook, withAllegiance } from '../../characters/look.js'
import characters from '../../data/characters.json'
import { sfx } from '../../audio/audio.js'
import { has } from '../../systems/powerups.js'

// A street fight as a 2D pixel-art fighting game: side-on, two pixel
// fighters (fight2d/pixel.js) in front of a pixel backdrop of wherever the
// fight is (fight2d/pixelStage.js), the camera sliding to keep both in shot. The rules are the same
// as before (fightLogic.js); this draws them and adds the feel: hit sparks,
// comic words, a split-second freeze on every blow, screen shake, a flash and
// a slow-motion knock-out.
//
// Pixel art renders to a screen-sized buffer (not the phone's full pixel
// density) and is scaled up with crisp square pixels by the browser, so it is
// light even on 2 GB phones. The 3D street is switched off while the fight is on.

const HIT_STOP = { punch: 0.06, kick: 0.09, special: 0.16 }
const WORDS = {
  punch: ['GBAM!', 'KPA!', 'POW!', 'WHAM!'],
  kick: ['KPAU!', 'BOOM!', 'GBOSA!', 'WHUMP!'],
  special: ['LAGOS ROUNDABOUT!', 'KPAKPAKPA!', 'GBAGAUN!'],
  block: ['BLOCK!', 'TCHK!', 'GUARD!'],
  air: ['FLYING KICK!', 'GBOSA!', 'WHOOSH-KPA!'],
}
const PAN = 4.5 // metres the camera can slide either way

/** A naira coin in pixels: u is one coin pixel on screen; it squashes sideways as it spins. */
const COIN_ROWS = ['..###..', '.#lll#.', '#lyyyl#', '#yynyy#', '#yyyyd#', '.#ddd#.', '..###..']
const COIN_COLORS = { '#': '#3a2405', l: '#ffe680', y: '#f2b705', d: '#c99a0e', n: '#8a5a00' }
function drawPixelCoin(ctx, x, y, u, spin) {
  const sx = Math.max(0.2, Math.abs(Math.cos(spin)))
  const cw = Math.max(1, Math.round(u * sx))
  COIN_ROWS.forEach((row, r) => {
    for (let c = 0; c < 7; c++) {
      const ch = row[c]
      if (ch === '.') continue
      ctx.fillStyle = COIN_COLORS[ch]
      ctx.fillRect(Math.round(x + (c - 3.5) * cw), Math.round(y + (r - 3.5) * u), cw, u)
    }
  })
}

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

export default function Fight2D({ params }) {
  const canvasRef = useRef()
  const game = useGameStore((s) => s.game)
  const time = useGameStore((s) => s.view?.time || 'day')
  const world = useGameStore((s) => s.view?.world || 'iyanaWahala')
  const activitySpot = useGameStore((s) => s.activity?.spot)
  const profile = opponentProfile(params.opponent)
  const fighters = useMemo(() => {
    const base = profile.character ? characters[profile.character]?.look : randomLook(profile.seed || 5, 'male')
    const player = withAllegiance(game?.player.look || {}, game?.flags || {})
    return { p: makePixelFighter(player), o: makePixelFighter({ ...base, ...(profile.lookOverride || {}) }) }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps
  // the HUD draws the same fighters in its round portrait badges
  useEffect(() => useFight.setState({ looks: fighters }), [fighters])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const stats = useGameStore.getState().game?.stats
    // harder (and a little quicker) as the story goes on; free-roam fights come already scaled (heat.js)
    const L = params.level ?? storyLevel(useGameStore.getState().game, storyCtx.chapters)
    const difficulty = params.storyScaled ? params.difficulty ?? 1 : Math.min(3.5, (params.difficulty ?? 1) + L * 1.2)
    const fight = createFight(profile, { energy: stats?.energy ?? 70, notoriety: stats?.notoriety ?? 0, difficulty, pace: 0.72 + L * 0.16, seed: (params.opponent || 'x').length + Math.floor(Math.random() * 9) })
    const light = effectiveQuality(useSettings.getState().quality) === 'low'
    let W = 0
    let H = 0
    let ppm = 100
    let PX = 8 // screen pixels per sprite pixel
    let groundY = 0
    let stage = null
    const { kind, place } = backdropFor(world, placeHere(world, activitySpot))
    const layout = () => {
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, Math.round(rect.width))
      H = Math.max(1, Math.round(rect.height))
      canvas.width = W // pixel art: a screen-sized buffer, scaled up crisply by CSS
      canvas.height = H
      const portrait = H > W
      // a fighter (21 sprite pixels) stands about 30% of the screen tall, and
      // both fit across with room around them, so the place shows
      groundY = H * (portrait ? 0.68 : 0.84)
      PX = Math.max(2, Math.round(Math.min((H * 0.3) / 21, (W / (portrait ? 4.6 : 7.4)) * M_PER_PX)))
      ppm = PX / M_PER_PX
      groundY = Math.round(groundY / PX) * PX
      stage = makePixelStage({ W, H, PX, groundY, pan: PAN + 2, time, kind, place, light, seed: (params.opponent || 'x').length * 31 + 7 })
    }
    layout()
    window.addEventListener('resize', layout)
    // the canvas can change size without a window resize (fullscreen, the page settling after loading)
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null
    watch?.observe(canvas)

    // per fighter: the drawn pose (eased towards the rules' pose), squash, afterimages
    const look = {
      p: { info: null, squash: 0, ghosts: [], ghostT: 0, trail: [], air: false },
      o: { info: null, squash: 0, ghosts: [], ghostT: 0, trail: [], air: false },
    }
    const fx = { sparks: [], bursts: [], words: [], coins: [], rings: [], shields: [], stars: 0, shake: 0, flash: 0, hitStop: 0, slow: 0, banner: null, cheer: 0.2 }
    let camX = 0
    const zoom = 1 // pixel art doesn't zoom: pixels stay whole
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
      // the pixel fighters: head about 1.1 m, chest about 0.65 m
      const y = victim.y + (kind === 'kick' ? 0.62 : kind === 'block' ? 0.85 : kind === 'air' ? 0.75 : kind === 'special' ? 1.0 : 0.9)
      const st = { throw: ['#fff3b0', '#ffb020', 0.42], punch: ['#fff3b0', '#ffb020', 0.36], kick: ['#ffe08a', '#ff7a1a', 0.48], air: ['#ffe08a', '#ff7a1a', 0.5], special: ['#ffffff', '#ff3d2e', 0.8], block: ['#d8f1ff', '#5aa9ff', 0.28] }[kind]
      fx.bursts.push({ x, y, t: 0, color: st[0], ring: st[1], size: st[2] })
      fx.rings.push({ x, y, t: 0, color: st[1], big: kind === 'special' || kind === 'kick' })
      if (kind === 'block') fx.shields.push({ x: victim.x - dir * 0.35, y: victim.y + 0.75, t: 0, dir })
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
        fx.sparks.push({ x: victim.x, y: victim.y + 1.3, vx: -dir * -1.5, vy: 2.5, life: 0.5, t: 0, color: '#bfe6ff', drop: true })
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
      // "Get back up": on your feet with some health, the same fight
      if (store.reviveReq) {
        fight.over = null
        fight.p.hp = Math.round(fight.p.maxHp * 0.45)
        fight.p.stunT = 0
        fight.p.action = null
        fight.o.action = null
        fight.o.x = Math.min(5.5, fight.p.x + 2.4)
        overT = 0
        endAt = 0
        fx.banner = { text: 'BACK UP!', t: 0 }
        fx.cheer = 0.8
        useFight.setState({ reviveReq: false })
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
        fightInput.punch = fightInput.kick = fightInput.special = fightInput.dodge = fightInput.jump = fightInput.throw = false
        for (const ev of fight.events) {
          const attacker = ev.who === 'player' ? fight.p : fight.o
          const victim = ev.who === 'player' ? fight.o : fight.p
          if (ev.type === 'hit' || ev.type === 'blocked') impact(ev.type === 'blocked' ? 'block' : ev.move, attacker, victim, ev.who)
          if (ev.recoil) fx.words.push({ text: 'OPEN!', x: attacker.x, y: attacker.y + 1.7, t: 0, rot: 0, kind: 'block' })
          // the crowd throws money: coins spin up off the opponent and fly to the purse
          for (let i = 0; i < (ev.coins || 0); i++) fx.coins.push({ x: victim.x, y: victim.y + 1.2, vx: (Math.random() - 0.3) * 2.5, vy: 3 + Math.random() * 2, t: -i * 0.08, spin: Math.random() * 6 })
          if (ev.coins) setTimeout(() => sfx('coin'), 350)
          if (ev.type === 'ducked') {
            fx.words.push({ text: 'DUCK!', x: victim.x, y: victim.y + 1.2, t: 0, rot: -0.1, kind: 'block' })
          }
          if (ev.type === 'jumped') {
            sfx('whoosh')
            fx.words.push({ text: 'OVER!', x: victim.x, y: victim.y + 1.6, t: 0, rot: 0.1, kind: 'block' })
          }
          if (ev.type === 'throw') {
            sfx('whoosh')
            continue
          }
          if (ev.type === 'dodged' || ev.type === 'jumped' || ev.type === 'ducked') sfx('whoosh')
          else if (ev.type === 'blocked') sfx('block')
          else if (ev.move === 'special') sfx('special')
          else if (ev.who === 'player') sfx(ev.move === 'kick' ? 'kick' : 'punch')
          else sfx('hurt')
        }
        const taken = before.p - fight.p.hp
        const dealt = before.o - fight.o.hp
        if (taken || dealt) useFight.setState({ stats: { dealt: store.stats.dealt + dealt, taken: store.stats.taken + taken } })
        if (fight.coins !== store.coins) setTimeout(() => useFight.setState({ coins: fight.coins }), 650) // when they land in the purse
        // the THROW button shows only while you stand by something
        const canThrow = Boolean(itemNear(fight, fight.p))
        if (canThrow !== store.canThrow) useFight.setState({ canThrow })
        hudTimer -= dt
        if (hudTimer <= 0 || taken || dealt) {
          hudTimer = 0.1
          if (fight.p.combo > store.bestCombo) useFight.setState({ bestCombo: fight.p.combo })
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
        const L = look[k]
        L.info = frameFor(fighters[k], f, MOVES, { over: fight.over, winner: (k === 'p') === (fight.over === 'won'), t: t + (k === 'o' ? 0.4 : 0), overT })
        L.squash = Math.max(0, L.squash - dt)
        // dust when the feet leave or meet the road
        const inAir = f.y > 0.02
        if (inAir !== L.air) fx.sparks.push(...dustPuff(f.x, inAir ? 4 : 7))
        L.air = inAir
        // afterimages while dodging or spinning
        L.ghostT -= dt
        const trail = f.dodgeT > 0 || f.action?.type === 'special' || f.action?.type === 'air' || f.action?.type === 'air'
        if (trail && L.ghostT <= 0) {
          L.ghostT = 0.035
          L.ghosts.push({ info: L.info, x: f.x, y: f.y, life: 0.22 })
          if (L.ghosts.length > (light ? 2 : 4)) L.ghosts.shift()
        }
        for (const g of L.ghosts) g.life -= dt
        L.ghosts = L.ghosts.filter((g) => g.life > 0)
        // the swoosh: where the fist or foot has been during the swing
        for (const q of L.trail) q.age += dt
        const a = f.action
        if (a) {
          const m = MOVES[a.type]
          if (a.t > m.startup * 0.45 && a.t < m.startup + m.active) {
            const rp = reachOf(lunge(L.info.frame))
            const tip = a.type === 'punch' ? rp.fist : rp.foot
            const dir = k === 'p' ? 1 : -1
            L.trail.push({ x: f.x + dir * tip[0], y: f.y + tip[1], age: 0, kind: a.type })
          }
        }
        L.trail = L.trail.filter((q) => q.age < 0.14).slice(-9)
      }
      // camera: follow the middle, ease out when they're far apart
      const mid = (fight.p.x + fight.o.x) / 2
      camX += (Math.max(-PAN, Math.min(PAN, mid)) - camX) * (1 - Math.exp(-dt * 5))
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
      for (const r of fx.rings) r.t += dt
      fx.rings = fx.rings.filter((r) => r.t < 0.28)
      for (const sh of fx.shields) sh.t += dt
      fx.shields = fx.shields.filter((sh) => sh.t < 0.2)
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

    // a wall of blocks with a hazard stripe: the end of the arena
    function drawWall(x, side) {
      const [sx] = toScreen(x, 0)
      const w = Math.max(PX * 4, ppm * 0.45)
      const h = ppm * 2.4
      const x0 = Math.round((sx - w / 2) / PX) * PX
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x0 - side * PX * 2, groundY - h + PX * 2, w, h)
      const rows = 6
      for (let r = 0; r < rows; r++) {
        const y = groundY - ((r + 1) * h) / rows
        ctx.fillStyle = r % 2 ? '#8a8378' : '#9d968a'
        ctx.fillRect(x0, Math.round(y), w, Math.ceil(h / rows))
        ctx.fillStyle = '#5f594f'
        ctx.fillRect(x0, Math.round(y), w, PX)
        ctx.fillRect(x0 + (r % 2 ? w / 2 : w / 4), Math.round(y), PX, Math.ceil(h / rows))
      }
      // the yellow and black stripe that says "no further"
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#1a1a1a' : '#f2c230'
        ctx.fillRect(x0, Math.round(groundY - h * 0.55 + i * PX * 2), w, PX * 2)
      }
    }

    // the things you can throw, in pixel art (on the road, or spinning in the air)
    function drawItem(kind, x, y, spin, glow) {
      const [sx, sy] = toScreen(x, y)
      const u = PX
      ctx.save()
      ctx.translate(Math.round(sx), Math.round(sy))
      if (y > 0.05 && kind !== 'tyre') ctx.rotate(spin)
      if (glow) {
        ctx.fillStyle = 'rgba(255,210,58,0.35)'
        ctx.fillRect(-u * 5, -u * 7, u * 10, u * 8)
      }
      if (kind === 'bottle') {
        ctx.fillStyle = '#2e7d4f'
        ctx.fillRect(-u, -u * 6, u * 2, u * 2)
        ctx.fillRect(-u * 2, -u * 4, u * 4, u * 4)
        ctx.fillStyle = '#9fe3b5'
        ctx.fillRect(-u, -u * 3, u, u * 2)
      } else if (kind === 'stone') {
        ctx.fillStyle = '#7d7468'
        ctx.fillRect(-u * 2, -u * 3, u * 4, u * 3)
        ctx.fillRect(-u * 3, -u * 2, u * 6, u * 2)
        ctx.fillStyle = '#a39a8c'
        ctx.fillRect(-u, -u * 3, u * 2, u)
      } else if (kind === 'crate') {
        ctx.fillStyle = '#a0662e'
        ctx.fillRect(-u * 3, -u * 5, u * 6, u * 5)
        ctx.fillStyle = '#6b4220'
        ctx.fillRect(-u * 3, -u * 5, u * 6, u)
        ctx.fillRect(-u * 3, -u * 3, u * 6, u)
        ctx.fillRect(-u * 3, -u, u * 6, u)
      } else {
        // the tyre: a ring that rolls
        ctx.fillStyle = '#1e1e22'
        ctx.fillRect(-u * 3, -u * 6, u * 6, u * 6)
        ctx.fillStyle = '#55555e'
        ctx.fillRect(-u, -u * 4, u * 2, u * 2)
        ctx.fillStyle = '#3a3a42'
        const k = Math.floor(spin * 2) % 2
        ctx.fillRect(-u * 3 + k * u * 4, -u * 6, u * 2, u)
      }
      ctx.restore()
    }

    function dustPuff(x, n = 10) {
      return Array.from({ length: light ? Math.ceil(n / 2) : n }, (_, i) => ({ x: x - 0.6 + (i / n) * 1.2, y: 0.05, vx: (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), life: 0.6, t: 0, color: 'rgba(200,185,160,0.8)', dust: true }))
    }

    // the lunge carries a blow to its target, but never through the other fighter
    const lunge = (frame) => {
      const room = Math.max(1, Math.floor((fight.o.x - fight.p.x - 1.0) / M_PER_PX))
      return frame.dx > room ? { ...frame, dx: room } : frame
    }

    function drawSprite(k, f, facing, alpha = 1, info = look[k].info, x = f.x, y = f.y) {
      if (!info) return
      const L = look[k]
      const frame = lunge(info.frame)
      const [sx, sy] = toScreen(x, y)
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.globalAlpha = alpha
      ctx.translate(Math.round(sx), Math.round(sy))
      ctx.scale(facing * PX, PX)
      if (info.rot) {
        // tipping over backwards about the feet, then lying on the ground
        ctx.translate(-(frame.dx || 0), info.lying ? -7 : -3)
        ctx.rotate(info.rot)
      }
      // the special is ready: a flickering aura round the fighter
      if (alpha === 1 && f.special >= 100 && !fight.over) {
        const aura = tintOf(fighters[k], info.frame, Math.floor(t * 12) % 2 ? '#ffd23a' : '#ff8a2a')
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(aura, -AX + (frame.dx || 0) + ox, -AY + oy, CW, CH)
      }
      // speed lines behind a lunge or a dodge
      if (alpha === 1 && ((frame.dx || 0) > 2 || f.dodgeT > 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        for (const [ly, len] of [[-14, 6], [-9, 9], [-4, 5]]) ctx.fillRect(-AX + (frame.dx || 0) - len - 1 + AX - 8, ly, len, 1)
      }
      // a white flash the moment a blow lands
      const img = alpha === 1 && L.squash > 0.1 ? flashOf(fighters[k], info.frame) : frame.canvas || info.frame.canvas
      ctx.drawImage(img, -AX + (frame.dx || 0), -AY, CW, CH)
      ctx.restore()
    }

    function render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // shake in whole sprite pixels, so the pixels stay square
      const shx = fx.shake ? Math.round(((Math.random() - 0.5) * fx.shake) / PX) * PX : 0
      const shy = fx.shake ? Math.round(((Math.random() - 0.5) * fx.shake) / PX) * PX : 0
      ctx.save()
      // zoom about the fighters' feet in the middle of the screen
      ctx.translate(W / 2 + shx, groundY + shy)
      ctx.scale(zoom, zoom)
      ctx.translate(-W / 2, -groundY)
      if (stage) stage.draw(ctx, camX, t, fx.cheer)
      // shadows on the road
      for (const k of ['p', 'o']) {
        const f = fight[k]
        const dx = look[k].info ? (lunge(look[k].info.frame).dx || 0) * M_PER_PX : 0
        const [sx] = toScreen(f.x + dx * (k === 'p' ? 1 : -1), 0) // follows the lunge
        // a blocky pixel shadow, smaller under a jumper
        const half = Math.max(2, Math.round(7 * Math.max(0.4, 1 - f.y * 0.5)))
        ctx.fillStyle = 'rgba(10,8,25,0.35)'
        ctx.fillRect(Math.round(sx / PX) * PX - half * PX, groundY, half * 2 * PX, PX)
        ctx.fillRect(Math.round(sx / PX) * PX - (half - 2) * PX, groundY + PX, (half - 2) * 2 * PX, PX)
      }
      // the walls at both ends of the arena: nobody goes past them
      for (const sd of [-1, 1]) drawWall(sd * (ARENA + 0.55), sd)
      // things lying about, and things in the air
      for (const it of fight.items) drawItem(it.kind, it.x, 0, 0, itemNear(fight, fight.p) === it)
      for (const q of fight.flying) drawItem(q.kind, q.x, q.y, q.spin, false)
      // the attacker in front, so the blow lands over the other one
      const order = fight.o.action && !fight.p.action ? ['p', 'o'] : ['o', 'p']
      for (const k of order) {
        const f = fight[k]
        const facing = k === 'p' ? 1 : -1
        look[k].ghosts.forEach((g, i) => drawSprite(k, f, facing, 0.12 + i * 0.05, g.info, g.x, g.y))
        drawSprite(k, f, facing)
      }
      // swooshes: a white crescent tapering away behind each swing
      for (const k of ['p', 'o']) {
        const tr = look[k].trail
        if (tr.length < 2) continue
        ctx.lineCap = 'round'
        for (let i = 1; i < tr.length; i++) {
          const a = tr[i - 1]
          const b = tr[i]
          const fade = 1 - b.age / 0.14
          const w = (i / tr.length) * ppm * (b.kind === 'punch' ? 0.16 : 0.24) * fade
          const [x1, y1] = toScreen(a.x, a.y)
          const [x2, y2] = toScreen(b.x, b.y)
          ctx.globalAlpha = 0.35 * fade
          ctx.strokeStyle = b.kind === 'special' ? '#ffb38a' : '#bfe6ff'
          ctx.lineWidth = w * 1.8
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.globalAlpha = 0.85 * fade
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = w
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.lineCap = 'butt'
      }
      // pixel rings spreading from each blow (a diamond of squares)
      for (const r of fx.rings) {
        const [x, y] = toScreen(r.x, r.y)
        const k = r.t / 0.28
        const rad = Math.round((r.big ? 9 : 6) * (0.3 + k)) // in sprite pixels
        ctx.globalAlpha = 1 - k
        ctx.fillStyle = r.color
        for (let i = 0; i < rad * 4; i++) {
          const q = i % rad
          const side = Math.floor(i / rad)
          const dx = [q, rad - q, -q, -(rad - q)][side]
          const dy = [rad - q, -q, -(rad - q), q][side]
          ctx.fillRect(Math.round(x / PX + dx) * PX, Math.round(y / PX + dy) * PX, PX, PX)
        }
        ctx.globalAlpha = 1
      }
      // a blue shield flash in front of whoever blocked
      for (const sh of fx.shields) {
        const [x, y] = toScreen(sh.x, sh.y)
        ctx.globalAlpha = 1 - sh.t / 0.2
        for (let j = -4; j <= 4; j++) {
          const bulge = 2 - Math.round(Math.abs(j) / 2)
          ctx.fillStyle = j % 2 ? '#bfe3ff' : '#4b8df0'
          ctx.fillRect(Math.round(x / PX - sh.dir * bulge) * PX, Math.round(y / PX + j) * PX, PX, PX)
        }
        ctx.globalAlpha = 1
      }
      // knocked out: little stars circling the loser's head
      if (fight.over && overT > 0.5) {
        const loser = fight.over === 'won' ? fight.o : fight.p
        const dir = fight.over === 'won' ? -1 : 1
        const [hx, hy] = toScreen(loser.x - dir * 1.0, 0.45)
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + (i * Math.PI * 2) / 3
          const sx = Math.round(hx / PX + Math.cos(a) * 6) * PX
          const sy = Math.round(hy / PX + Math.sin(a) * 2) * PX
          ctx.fillStyle = i % 2 ? '#ffd23a' : '#ffffff'
          ctx.fillRect(sx, sy - PX, PX, PX * 3)
          ctx.fillRect(sx - PX, sy, PX * 3, PX)
        }
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
          // square pixel sparks, snapped to the grid
          ctx.fillStyle = s.color
          const size = k > 0.5 ? PX * 2 : PX
          ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, size, size)
        }
      }
      ctx.globalAlpha = 1
      ctx.restore()
      if (stage) stage.drawFront(ctx, camX, t)
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
        drawPixelCoin(ctx, x, y, Math.max(2, Math.round(PX * 0.75 * (c.t > 0.35 ? 1 - (c.t - 0.35) * 0.9 : 1))), c.spin + c.t * 14)
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
      // (the first frame's timestamp can be a little before the start: never step backwards)
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      if (!isPaused()) step(dt) // paused: the picture holds
      // Light mode (budget phones): draw at most 30 times a second, like the 3D street
      if (light && now - drawnAt < 30) return
      drawnAt = now
      render()
    }
    raf = requestAnimationFrame(frame)
    // a held button never sees its release while the pause menu is up: let go of everything
    const unPause = usePause.subscribe((st, prev) => {
      if (st.paused && !prev.paused) Object.assign(fightInput, { move: 0, block: false, crouch: false, punch: false, kick: false, special: false, dodge: false, jump: false })
    })
    if (import.meta.env.DEV) window.__fight2d = { fight, fx, look }
    return () => {
      cancelAnimationFrame(raf)
      unPause()
      window.removeEventListener('resize', layout)
      watch?.disconnect()
    }
  }, [fighters]) // eslint-disable-line react-hooks/exhaustive-deps

  // drawn over the (paused) 3D street, under the game's top bar and buttons
  const host = typeof document !== 'undefined' ? document.querySelector('.story-screen') : null
  const el = <canvas ref={canvasRef} className="fight2d-canvas" aria-label="Street fight" />
  return host ? createPortal(el, host) : el
}
