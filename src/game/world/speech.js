// Speech bubbles over people and cars in the 3D street ("Comot for road!").
// Plain DOM elements in the #speech-layer div (StoryScreen), moved every
// frame by ReactionDirector to sit above whoever is talking. No React
// re-renders, and only a handful exist at once.

import * as THREE from 'three'

const bubbles = [] // { el, at, until }
const v = new THREE.Vector3()
const MAX = 4

/**
 * Show `text` above a point. `at` is a function returning { x, y, z } (so it
 * follows a moving person or car) or a fixed { x, y, z }.
 */
export function say(text, at, { seconds = 2.8, tone = '' } = {}) {
  const layer = typeof document !== 'undefined' && document.getElementById('speech-layer')
  if (!layer || !text) return
  while (bubbles.length >= MAX) drop(0)
  const el = document.createElement('div')
  el.className = `speech-bubble ${tone}`
  el.textContent = text
  el.style.visibility = 'hidden'
  layer.appendChild(el)
  bubbles.push({ el, at, until: performance.now() + seconds * 1000 })
}

function drop(i) {
  bubbles[i].el.remove()
  bubbles.splice(i, 1)
}

export function clearSpeech() {
  while (bubbles.length) drop(0)
}

/** Every frame: put each bubble over its speaker on screen. */
export function updateSpeech(camera, width, height) {
  const now = performance.now()
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]
    if (now > b.until) {
      drop(i)
      continue
    }
    const p = typeof b.at === 'function' ? b.at() : b.at
    v.set(p.x, p.y, p.z).project(camera)
    const behind = v.z > 1 || v.z < -1
    const x = (v.x * 0.5 + 0.5) * width
    const y = (-v.y * 0.5 + 0.5) * height
    b.el.style.visibility = behind ? 'hidden' : 'visible'
    b.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`
    b.el.style.opacity = Math.min(1, (b.until - now) / 300).toFixed(2)
  }
}
