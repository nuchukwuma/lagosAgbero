// Recorded voice lines (rendered with skill-tts: scripts/render-voices.mjs):
// mission briefings, raid warnings, chants and call-outs, radio and street
// announcements. Each is a small MP3, fetched and decoded ahead of time
// (preloadVoices) so playing one never stalls a frame. They play through the
// game's sound bus with an effect for where the voice comes from:
//   radio      a small speaker (band-passed, a little crackle)
//   megaphone  a loudhailer (thin and harsh)
//   crowd      several voices at once, a beat apart (chants)
// While a line plays the music dips. Settings → Voices off silences them.
import manifest from './voiceLines.json'
import { ASSET_ROOT } from '../../../assets/assetManifest.js'
import { audioGraph, duckMusic } from '../audio.js'
import { useSettings } from '../../store/settings.js'

export const VOICE_LINES = manifest.lines
const buffers = new Map() // id -> AudioBuffer
const loading = new Map() // id -> Promise
const DEFAULT_FX = { radio: 'radio', raid: 'megaphone', chant: 'crowd', announce: 'megaphone' }
let current = null
let lastPlayed = new Map() // id -> time, so call-outs don't repeat every second

/** Fetch and decode these lines (ids, or kinds like 'raid'), if the sound has been unlocked. */
export function preloadVoices(which) {
  const g = audioGraph()
  if (!g) return Promise.resolve()
  const ids = Object.keys(VOICE_LINES).filter((id) => which.includes(id) || which.includes(VOICE_LINES[id].kind))
  return Promise.all(
    ids.map((id) => {
      if (buffers.has(id)) return null
      if (!loading.has(id))
        loading.set(
          id,
          fetch(`${ASSET_ROOT}/${VOICE_LINES[id].file}`)
            .then((r) => r.arrayBuffer())
            .then((b) => g.ctx.decodeAudioData(b))
            .then((buf) => {
              buffers.set(id, buf)
              trim()
            })
            .catch(() => loading.delete(id)),
        )
      return loading.get(id)
    }),
  )
}

// decoded audio is big (about 1 MB for a 6-second line): keep only the last few
const KEEP = 8
function trim() {
  while (buffers.size > KEEP) {
    const oldest = buffers.keys().next().value
    buffers.delete(oldest)
    loading.delete(oldest)
  }
}

function chain(ctx, fx) {
  const input = ctx.createGain()
  let tail = input
  const add = (node) => {
    tail.connect(node)
    tail = node
    return node
  }
  if (fx === 'radio') {
    const bp = add(ctx.createBiquadFilter())
    bp.type = 'bandpass'
    bp.frequency.value = 1700
    bp.Q.value = 0.9
    const shaper = add(ctx.createWaveShaper())
    shaper.curve = drive(3)
  } else if (fx === 'megaphone') {
    const hp = add(ctx.createBiquadFilter())
    hp.type = 'highpass'
    hp.frequency.value = 520
    const shaper = add(ctx.createWaveShaper())
    shaper.curve = drive(6)
  }
  return { input, tail }
}

function drive(k) {
  const n = 1024
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return c
}

/**
 * Play a recorded line. Returns true if it played. Options:
 *   fx: 'radio' | 'megaphone' | 'crowd' | 'none'  (default by kind)
 *   volume: 0..1 · minGap: seconds before the same line may play again
 */
export function playVoice(id, { fx, volume = 1, minGap = 0 } = {}) {
  const line = VOICE_LINES[id]
  const g = audioGraph()
  if (!line || !g || g.ctx.state !== 'running' || useSettings.getState().voices === false) return false
  const now = g.ctx.currentTime
  if (minGap && now - (lastPlayed.get(id) ?? -Infinity) < minGap) return false
  const buf = buffers.get(id)
  if (!buf) {
    preloadVoices([id]) // next time
    return false
  }
  lastPlayed.set(id, now)
  // most recently used last (the cache drops the oldest)
  buffers.delete(id)
  buffers.set(id, buf)
  stopVoice()
  const effect = fx ?? DEFAULT_FX[line.kind] ?? 'none'
  const { input, tail } = chain(g.ctx, effect === 'crowd' ? 'none' : effect)
  const gain = g.ctx.createGain()
  gain.gain.value = volume
  tail.connect(gain).connect(g.out)
  const sources = []
  // a crowd: the same chant from several throats, a little apart and out of tune
  const copies = effect === 'crowd' ? [0, 0.07, 0.15, 0.22] : [0]
  copies.forEach((delay, i) => {
    const s = g.ctx.createBufferSource()
    s.buffer = buf
    s.detune.value = i ? (i % 2 ? -1 : 1) * (60 + i * 30) : 0
    const v = g.ctx.createGain()
    v.gain.value = i ? 0.55 : 1
    s.connect(v).connect(input)
    s.start(now + delay)
    sources.push(s)
  })
  duckMusic(true)
  current = { sources, gain }
  sources[0].onended = () => {
    if (current?.sources === sources) {
      current = null
      duckMusic(false)
    }
  }
  return true
}

export function stopVoice() {
  if (!current) return
  for (const s of current.sources)
    try {
      s.stop()
    } catch {
      // already stopped
    }
  current = null
  duckMusic(false)
}

/** For tests and tools: the lines of one kind. */
export const voiceIdsOf = (kind) => Object.keys(VOICE_LINES).filter((id) => VOICE_LINES[id].kind === kind)
