// Drawing helpers shared by the arcade mini-games: chunky pixel art at an
// integer pixel size P, sprites from character maps, outlined labels, and a
// small seeded random. All the games' art is drawn from these (no image files),
// so they stay sharp on any screen and cost nothing to download.

export const INK = '#0e0d1e'

/** Screen size in CSS pixels -> the game's pixel size P (about 120 pixels on the short side). */
export function viewFor(W, H) {
  const P = Math.max(2, Math.floor(Math.min(W, H) / 120))
  return { W, H, P, portrait: H > W }
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** A box with a P-thick ink border (the pixel-art panel). */
export function box(ctx, x, y, w, h, fill, P, border = INK) {
  rect(ctx, x - P, y - P, w + 2 * P, h + 2 * P, border)
  rect(ctx, x, y, w, h, fill)
}

/**
 * A sprite from a character map: rows of characters, '.' or ' ' transparent,
 * every other character looked up in the palette. Drawn with its top-left at
 * (x, y), each map pixel P screen pixels wide. flip mirrors it.
 */
export function sprite(ctx, rows, palette, x, y, P, flip = false) {
  const w = rows[0].length
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      const color = palette[ch]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x + (flip ? w - 1 - c : c) * P), Math.round(y + r * P), P, P)
    }
  }
}
export const spriteSize = (rows, P) => ({ w: rows[0].length * P, h: rows.length * P })

const isDark = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c)
  if (!m) return false
  const n = parseInt(m[1], 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 110
}

/** Outlined text, chunky and readable over anything (never smaller than 10px). Dark text gets a light halo instead of an ink one. */
export function label(ctx, text, x, y, { size = 12, color = '#fff', align = 'center', alpha = 1, weight = 900 } = {}) {
  size = Math.max(10, size)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `${weight} ${Math.round(size)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const dark = isDark(color)
  ctx.lineWidth = dark ? Math.max(2, size / 6) : Math.max(3, size / 4)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.75)' : INK
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** A pixel-art disc (draughts pieces, akara, coins, the ball). */
export function disc(ctx, cx, cy, r, color, P, rim = INK) {
  const n = Math.max(2, Math.round(r / P))
  for (let yy = -n; yy <= n; yy++) {
    const half = Math.round(Math.sqrt(Math.max(0, n * n - yy * yy)))
    rect(ctx, cx - (half + 1) * P, cy + yy * P - P / 2, (half * 2 + 2) * P, P, rim)
  }
  for (let yy = -n + 1; yy <= n - 1; yy++) {
    const half = Math.round(Math.sqrt(Math.max(0, (n - 1) * (n - 1) - yy * yy)))
    rect(ctx, cx - (half + 1) * P + P, cy + yy * P - P / 2, half * 2 * P, P, color)
  }
}

export const inside = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

/** Seeded random in [0, 1) (mulberry32): the same seed gives the same game. */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const pickOf = (r, list) => list[Math.floor(r() * list.length)]
export function shuffle(r, list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

/** A simple sky-to-ground backdrop with a few blocks of town, for games that happen outdoors. */
export function backdrop(ctx, v, { sky = '#7fc8ff', ground = '#c9a46a', horizon = 0.55, buildings = true, seed = 3 } = {}) {
  const { W, H, P } = v
  const hy = Math.round((H * horizon) / P) * P
  rect(ctx, 0, 0, W, hy, sky)
  if (buildings) {
    const r = rng(seed)
    let x = -P * 4
    while (x < W) {
      const w = P * (14 + Math.floor(r() * 18))
      const h = P * (10 + Math.floor(r() * 26))
      const c = pickOf(r, ['#d9c7a8', '#c27b56', '#8aa0b4', '#e2d39a', '#b56d6d', '#9fb88a'])
      rect(ctx, x, hy - h, w - P, h, c)
      rect(ctx, x, hy - h, w - P, P * 2, '#5c3b2e')
      for (let wy = hy - h + P * 5; wy < hy - P * 4; wy += P * 6) for (let wx = x + P * 3; wx < x + w - P * 5; wx += P * 6) rect(ctx, wx, wy, P * 2, P * 3, '#3a4a5c')
      x += w
    }
  }
  rect(ctx, 0, hy, W, H - hy, ground)
  return hy
}

// ---- small sprites used by several games ----
export const PAL = {
  k: INK, w: '#ffffff', W: '#f4ecd8', r: '#d9342b', R: '#ff6b4a', g: '#2e9e4f', G: '#8ff0a4', b: '#2f6fd6', B: '#7fc8ff',
  y: '#ffd23a', Y: '#fff2a8', o: '#f08a24', O: '#ffb36b', n: '#7a4a24', N: '#b5793e', s: '#8a8f99', S: '#c9ccd2', p: '#9b59b6', P: '#d7b4ec', d: '#3a2a20', t: '#c79a6a',
}

/** The unit for panels that hold text: never so small that labels overlap. */
export const ui = (P) => Math.max(P, 3)
