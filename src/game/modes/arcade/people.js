// People in the mini-games: the same pixel characters as the fights and the
// dance battles (one sprite atlas per look, made once and cached).
import { makePixelFighter, CW, CH, AX, AY } from '../fight/fight2d/pixel.js'
import { randomLook } from '../../characters/look.js'
import characters from '../../data/characters.json'

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

/**
 * Draw a person standing with their feet at (x, y), P screen pixels per sprite
 * pixel. pose: stand | walk | cheer | idle | hit | win; t (seconds) animates it.
 */
export function drawPerson(ctx, who, x, y, P, { pose = 'stand', t = 0, facing = 1, alpha = 1 } = {}) {
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
