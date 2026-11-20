// People in the mini-games: Eris Esra's character template painted for each
// person (eris.js), or the fights' pixel characters until its picture loads.
import { makePixelFighter, CW, CH, AX, AY } from '../fight/fight2d/pixel.js'
import { randomLook } from '../../characters/look.js'
import characters from '../../data/characters.json'
import { drawEris } from '../../characters/eris.js'

const cache = new Map()

/** A pixel character for a character id, a look object, or a seed (a stranger). */
export function personFor(who) {
  const key = typeof who === 'string' || typeof who === 'number' ? String(who) : JSON.stringify(who)
  if (!cache.has(key)) {
    let look
    if (typeof who === 'number') look = randomLook(who, who % 3 === 2 ? 'female' : 'male')
    else if (typeof who === 'string') look = characters[who]?.look || randomLook(who.length * 7, 'male')
    else look = who
    cache.set(key, makePixelFighter(look || {}))
    if (cache.size > 60) cache.delete(cache.keys().next().value)
  }
  return cache.get(key)
}

/** The look for a character id, a look object, or a seed. */
export function lookFor(who) {
  if (typeof who === 'number') return randomLook(who, who % 3 === 2 ? 'female' : 'male')
  if (typeof who === 'string') return characters[who]?.look || randomLook(who.length * 7, 'male')
  return who || {}
}

// poses -> the template's animations (front view for people facing you, side view on the move)
const ERIS_POSE = {
  stand: ['idle', 'front', 4], idle: ['idle', 'front', 4], walk: ['walk', 'side', 8], stroll: ['walk', 'side', 6],
  cheer: ['jump', 'front', 8], win: ['jump', 'front', 8], jumpUp: ['jump', 'front', 0], punch: ['attack', 'side', 10], hit: ['interact', 'front', 0],
}

// the template is 25 pixels tall, the pixel fighters 36: people keep their size
const ERIS_SCALE = 36 / 25

/**
 * Draw a person standing with their feet at (x, y), P screen pixels per sprite
 * pixel. pose: stand | idle | walk | stroll | cheer | win | jumpUp | punch | hit;
 * t (seconds) animates it.
 */
export function drawPerson(ctx, who, x, y, P, opts = {}) {
  // Eris Esra's template, painted for this person; the old pixel fighter until it has loaded
  const { pose = 'stand', t = 0, facing = 1, alpha = 1 } = opts
  const [anim, view, fps] = ERIS_POSE[pose] || ERIS_POSE.stand
  const frame = pose === 'jumpUp' ? 2 : pose === 'hit' ? 1 : t * fps
  if (drawEris(ctx, lookFor(who), anim, frame, x, y, P * ERIS_SCALE, { facing: view, dir: facing, alpha, rotate: pose === 'hit' ? -0.25 * facing : 0 })) return
  drawFighterPerson(ctx, who, x, y, P, opts)
}

function drawFighterPerson(ctx, who, x, y, P, { pose = 'stand', t = 0, facing = 1, alpha = 1 } = {}) {
  const f = personFor(who)
  const frames = f.frames[pose] || f.frames.stand || f.frames.idle
  const frame = frames[Math.floor(t * 4) % frames.length]
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = false
  ctx.translate(Math.round(x), Math.round(y))
  ctx.scale(facing * P, P)
  ctx.drawImage(frame.canvas, -AX, -AY, CW, CH)
  ctx.restore()
}
