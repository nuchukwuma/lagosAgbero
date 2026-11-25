// Share cards: a picture for WhatsApp, Instagram, X... of a big moment
// ("Escaped the EFCC raid with ₦50M", "Out through the Back Gate"), drawn on a
// canvas: the 3D view behind (if there is one), the headline, a few numbers.
import { create } from 'zustand'
import { captureView } from '../../game/world/capture.js'

export const W = 1080
export const H = 1350 // 4:5, what feeds show best

export const useShareCard = create(() => ({ card: null })) // { kicker, title, line, stats: [[label, value]], tone, shot }

/** Open the share card for a moment. The 3D view is captured first (if it's showing). */
export async function openShareCard(card) {
  const shot = card.shot === false ? null : await captureView()
  useShareCard.setState({ card: { ...card, shot } })
}
export const closeShareCard = () => useShareCard.setState({ card: null })

const TONES = { gold: ['#f6e3a1', '#e9c46a', '#9a6b1f'], neon: ['#ff8ab0', '#ff3d7f', '#a3124a'], green: ['#8ff0c4', '#19d38a', '#0b7a4e'] }

function wrap(g, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

/** Draw the card on a canvas (W x H). */
export async function drawShareCard(canvas, card) {
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  try {
    await Promise.all([document.fonts?.load('120px "Bebas Neue"'), document.fonts?.load('700 40px "Space Grotesk"')])
  } catch {
    // fonts not ready: the fallbacks are fine
  }
  const [c1, c2, c3] = TONES[card.tone] || TONES.gold
  g.fillStyle = '#07070b'
  g.fillRect(0, 0, W, H)
  // the 3D view, filling the top, fading into the dark
  const img = await loadImage(card.shot)
  if (img) {
    const scale = Math.max(W / img.width, (H * 0.68) / img.height)
    const w = img.width * scale
    const h = img.height * scale
    g.drawImage(img, (W - w) / 2, 0, w, h)
  } else {
    const rg = g.createRadialGradient(W * 0.3, H * 0.2, 50, W * 0.3, H * 0.2, 900)
    rg.addColorStop(0, `${c2}55`)
    rg.addColorStop(1, '#07070b')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  const fade = g.createLinearGradient(0, H * 0.25, 0, H * 0.75)
  fade.addColorStop(0, 'rgba(7,7,11,0)')
  fade.addColorStop(1, 'rgba(7,7,11,1)')
  g.fillStyle = fade
  g.fillRect(0, 0, W, H)
  // a thin frame
  g.strokeStyle = `${c2}88`
  g.lineWidth = 4
  g.strokeRect(28, 28, W - 56, H - 56)

  let y = H * 0.5
  g.textBaseline = 'alphabetic'
  if (card.kicker) {
    g.font = '700 30px "Space Grotesk", system-ui, sans-serif'
    g.fillStyle = c2
    g.fillText(card.kicker.toUpperCase().split('').join(String.fromCharCode(8202)), 80, y)
    y += 28
  }
  g.font = '400 132px "Bebas Neue", Impact, sans-serif'
  const grad = g.createLinearGradient(0, y, 0, y + 260)
  grad.addColorStop(0, c1)
  grad.addColorStop(0.55, c2)
  grad.addColorStop(1, c3)
  g.fillStyle = grad
  for (const line of wrap(g, card.title, W - 160).slice(0, 3)) {
    y += 120
    g.fillText(line, 80, y)
  }
  if (card.line) {
    g.font = '500 36px "Space Grotesk", system-ui, sans-serif'
    g.fillStyle = '#d9d3c4'
    y += 30
    for (const line of wrap(g, card.line, W - 160).slice(0, 3)) {
      y += 48
      g.fillText(line, 80, y)
    }
  }
  // the numbers
  const stats = (card.stats || []).slice(0, 4)
  if (stats.length) {
    y = Math.max(y + 120, H - 290)
    const colW = (W - 160) / stats.length
    stats.forEach(([label, value], i) => {
      const x = 80 + i * colW
      g.font = '400 76px "Bebas Neue", Impact, sans-serif'
      g.fillStyle = '#f3ead2'
      g.fillText(String(value), x, y)
      g.font = '700 24px "Space Grotesk", system-ui, sans-serif'
      g.fillStyle = c2
      g.fillText(String(label).toUpperCase(), x, y + 36)
    })
  }
  // the name
  g.font = '400 64px "Bebas Neue", Impact, sans-serif'
  g.fillStyle = '#e9c46a'
  g.fillText('NAIJA', 80, H - 72)
  const nw = g.measureText('NAIJA').width
  g.fillStyle = '#ff3d7f'
  g.fillText('VICE', 80 + nw, H - 72)
  g.font = '500 24px "Space Grotesk", system-ui, sans-serif'
  g.fillStyle = '#8f8878'
  g.textAlign = 'right'
  g.fillText('satire · game money only', W - 80, H - 80)
  g.textAlign = 'left'
  return canvas
}

/** Share the picture (the phone's share sheet with the image), or save it. Returns 'shared' | 'saved' | 'failed'. */
export async function shareCanvas(canvas, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return 'failed'
  const file = new File([blob], 'naijavice.png', { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text })
      return 'shared'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'failed'
  }
  return saveCanvas(canvas, blob)
}

export async function saveCanvas(canvas, blob) {
  const b = blob || (await new Promise((r) => canvas.toBlob(r, 'image/png')))
  if (!b) return 'failed'
  const url = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = url
  a.download = 'naijavice.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
