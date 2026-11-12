// All the game's sound, made in the browser with the Web Audio API.
// There are no audio files: every effect is a few oscillators and noise
// bursts, the street ambience is filtered noise, and the music is a small
// step sequencer playing highlife-style patterns. Total download: zero.
//
//   sfx('coin')            one-shot effects (see SFX below)
//   setMusic('street')     street | night | tension | drive | menu | none
//   setAmbience({ street: 1, rain: 0, night: 0 })
//   engine(speed 0..1)     the danfo engine while driving (null to stop)
//   setVolumes({ music: true, sound: true })
//
// Browsers only allow sound after a tap or key press: unlock() is called on
// the first one (see AudioDirector.jsx).

let ctx = null
let master = null
let musicBus = null
let sfxBus = null
let ambBus = null
let noiseBuffer = null
const state = { music: true, sound: true, mood: 'none', wantMood: 'none', amb: { street: 0, rain: 0, night: 0 } }

export function audioReady() {
  return Boolean(ctx)
}

export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return
  }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  try {
    ctx = new AC({ latencyHint: 'interactive' })
  } catch {
    return
  }
  master = ctx.createGain()
  master.gain.value = 0.9
  // a gentle limiter so stacked effects never clip on phone speakers
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 6
  master.connect(comp).connect(ctx.destination)
  musicBus = ctx.createGain()
  sfxBus = ctx.createGain()
  ambBus = ctx.createGain()
  musicBus.gain.value = state.music ? 0.32 : 0
  sfxBus.gain.value = state.sound ? 0.8 : 0
  ambBus.gain.value = state.sound ? 0.5 : 0
  for (const b of [musicBus, sfxBus, ambBus]) b.connect(master)
  // two seconds of white noise, reused by everything noisy
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuffer.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  startAmbience()
  startSequencer()
  setMusic(state.wantMood)
}

export function setVolumes({ music, sound }) {
  if (music !== undefined) state.music = music
  if (sound !== undefined) state.sound = sound
  if (!ctx) return
  const t = ctx.currentTime
  musicBus.gain.setTargetAtTime(state.music ? 0.32 : 0, t, 0.1)
  sfxBus.gain.setTargetAtTime(state.sound ? 0.8 : 0, t, 0.05)
  ambBus.gain.setTargetAtTime(state.sound ? 0.5 : 0, t, 0.2)
}

/** Pause everything when the tab is hidden. */
export function suspend(hidden) {
  if (!ctx) return
  if (hidden) ctx.suspend().catch(() => {})
  else ctx.resume().catch(() => {})
}

// ---------- building blocks ----------
function env(gainNode, t, attack, peak, decay) {
  const g = gainNode.gain
  g.cancelScheduledValues(t)
  g.setValueAtTime(0.0001, t)
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone({ type = 'sine', f = 440, to = null, t = 0, a = 0.005, d = 0.15, v = 0.3, bus = sfxBus, detune = 0 }) {
  const start = ctx.currentTime + t
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, start)
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + a + d)
  o.detune.value = detune
  env(g, start, a, v, d)
  o.connect(g).connect(bus)
  o.start(start)
  o.stop(start + a + d + 0.05)
}

function noise({ t = 0, a = 0.002, d = 0.1, v = 0.3, type = 'lowpass', f = 1200, q = 0.7, to = null, bus = sfxBus }) {
  const start = ctx.currentTime + t
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filt = ctx.createBiquadFilter()
  filt.type = type
  filt.frequency.setValueAtTime(f, start)
  if (to) filt.frequency.exponentialRampToValueAtTime(to, start + a + d)
  filt.Q.value = q
  const g = ctx.createGain()
  env(g, start, a, v, d)
  src.connect(filt).connect(g).connect(bus)
  src.start(start, Math.random() * 1.5)
  src.stop(start + a + d + 0.05)
}

// ---------- one-shot effects ----------
const SFX = {
  click: () => tone({ type: 'triangle', f: 620, to: 420, d: 0.05, v: 0.18 }),
  open: () => {
    tone({ type: 'sine', f: 440, d: 0.08, v: 0.16 })
    tone({ type: 'sine', f: 660, t: 0.06, d: 0.1, v: 0.16 })
  },
  coin: () => {
    tone({ type: 'square', f: 1320, d: 0.06, v: 0.12 })
    tone({ type: 'square', f: 1760, t: 0.06, d: 0.16, v: 0.12 })
  },
  cash: () => {
    for (let i = 0; i < 4; i++) tone({ type: 'square', f: 1200 + i * 220, t: i * 0.05, d: 0.08, v: 0.1 })
    noise({ t: 0.02, d: 0.18, v: 0.08, type: 'highpass', f: 5000 })
  },
  spend: () => {
    tone({ type: 'triangle', f: 520, to: 300, d: 0.16, v: 0.2 })
  },
  notify: () => {
    tone({ type: 'sine', f: 784, d: 0.18, v: 0.16 })
    tone({ type: 'sine', f: 1175, t: 0.09, d: 0.26, v: 0.12 })
  },
  // dialogue "voice": a few blips at the speaker's pitch
  talk: (pitch = 1) => {
    const n = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) tone({ type: 'square', f: (150 + Math.random() * 60) * pitch, t: i * 0.065, a: 0.004, d: 0.045, v: 0.07 })
  },
  punch: () => {
    noise({ d: 0.07, v: 0.5, f: 900, to: 200 })
    tone({ type: 'sine', f: 160, to: 60, d: 0.12, v: 0.5 })
  },
  kick: () => {
    noise({ d: 0.1, v: 0.55, f: 600, to: 120 })
    tone({ type: 'sine', f: 120, to: 42, d: 0.2, v: 0.6 })
  },
  block: () => {
    tone({ type: 'square', f: 300, to: 180, d: 0.06, v: 0.2 })
    noise({ d: 0.04, v: 0.2, type: 'bandpass', f: 2400, q: 3 })
  },
  whoosh: () => noise({ a: 0.05, d: 0.18, v: 0.2, type: 'bandpass', f: 500, to: 2600, q: 1.2 }),
  hurt: () => {
    noise({ d: 0.12, v: 0.5, f: 500, to: 150 })
    tone({ type: 'sawtooth', f: 220, to: 90, d: 0.22, v: 0.25 })
  },
  special: () => {
    noise({ a: 0.12, d: 0.35, v: 0.35, type: 'bandpass', f: 300, to: 3200, q: 2 })
    tone({ type: 'sawtooth', f: 110, to: 440, a: 0.1, d: 0.3, v: 0.3 })
    tone({ type: 'sine', f: 90, to: 40, t: 0.32, d: 0.35, v: 0.7 })
  },
  ko: () => {
    tone({ type: 'sine', f: 110, to: 36, d: 0.6, v: 0.7 })
    noise({ d: 0.4, v: 0.4, f: 400, to: 80 })
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.11, d: 0.3, v: 0.22 })),
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.16, d: 0.36, v: 0.2 })),
  horn: (pitch = 1) => {
    for (const f of [392, 494]) tone({ type: 'sawtooth', f: f * pitch, a: 0.02, d: 0.26, v: 0.12, detune: Math.random() * 20 })
  },
  hornLong: () => {
    for (const f of [311, 392]) tone({ type: 'sawtooth', f, a: 0.03, d: 0.7, v: 0.16 })
  },
  whistle: () => {
    for (let i = 0; i < 2; i++) {
      tone({ type: 'sine', f: 2500, to: 2900, t: i * 0.32, a: 0.02, d: 0.24, v: 0.14 })
      tone({ type: 'sine', f: 2560, to: 2960, t: i * 0.32, a: 0.02, d: 0.24, v: 0.1 })
    }
  },
  siren: () => {
    for (let i = 0; i < 3; i++) tone({ type: 'square', f: 620, to: 930, t: i * 0.5, a: 0.2, d: 0.28, v: 0.09 })
  },
  crash: () => {
    noise({ d: 0.35, v: 0.7, f: 3000, to: 200 })
    tone({ type: 'sine', f: 90, to: 40, d: 0.3, v: 0.6 })
    noise({ t: 0.08, d: 0.5, v: 0.2, type: 'highpass', f: 4000 })
  },
  bump: () => {
    noise({ d: 0.1, v: 0.35, f: 700, to: 200 })
    tone({ type: 'sine', f: 140, to: 70, d: 0.1, v: 0.35 })
  },
  jump: () => tone({ type: 'sine', f: 300, to: 620, d: 0.14, v: 0.16 }),
  slide: () => noise({ a: 0.02, d: 0.22, v: 0.2, type: 'bandpass', f: 1800, to: 500, q: 1 }),
  door: () => {
    noise({ d: 0.06, v: 0.3, f: 500 })
    tone({ type: 'square', f: 180, to: 120, t: 0.05, d: 0.08, v: 0.15 })
  },
  radio: () => {
    noise({ d: 0.25, v: 0.12, type: 'bandpass', f: 2200, q: 4 })
    ;[660, 880, 990].forEach((f, i) => tone({ type: 'square', f, t: 0.2 + i * 0.1, d: 0.12, v: 0.09 }))
  },
  fuel: () => noise({ a: 0.05, d: 0.7, v: 0.16, type: 'bandpass', f: 900, q: 2 }),
  correct: () => {
    tone({ type: 'sine', f: 660, d: 0.1, v: 0.18 })
    tone({ type: 'sine', f: 990, t: 0.09, d: 0.18, v: 0.18 })
  },
  wrong: () => {
    tone({ type: 'sawtooth', f: 180, d: 0.16, v: 0.16 })
    tone({ type: 'sawtooth', f: 150, t: 0.14, d: 0.24, v: 0.16 })
  },
  crowd: () => noise({ a: 0.2, d: 0.9, v: 0.2, type: 'bandpass', f: 1100, q: 0.8 }),
  thunder: () => noise({ a: 0.05, d: 1.6, v: 0.5, f: 220, to: 60 }),
}

export const SFX_NAMES = Object.keys(SFX)

export function sfx(name, arg) {
  if (!ctx || !state.sound || ctx.state !== 'running') return
  try {
    SFX[name]?.(arg)
  } catch {
    // a failed sound must never break the game
  }
}

// ---------- ambience ----------
const amb = {}

function loopNoise(type, f, q) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filt = ctx.createBiquadFilter()
  filt.type = type
  filt.frequency.value = f
  filt.Q.value = q
  const g = ctx.createGain()
  g.gain.value = 0
  src.connect(filt).connect(g).connect(ambBus)
  src.start()
  return { g, filt }
}

function startAmbience() {
  amb.rumble = loopNoise('lowpass', 160, 0.5) // far traffic
  amb.chatter = loopNoise('bandpass', 1100, 0.9) // market voices
  amb.rain = loopNoise('highpass', 2600, 0.3)
  // generator hum for the night
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = 52
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 220
  const g = ctx.createGain()
  g.gain.value = 0
  o.connect(lp).connect(g).connect(ambBus)
  o.start()
  amb.gen = { g }
  setAmbience(state.amb)
  // life: a horn, a shout or a bell every few seconds
  const life = () => {
    if (ctx.state === 'running' && state.amb.street > 0.3) {
      const r = Math.random()
      const far = ctx.createGain()
      far.gain.value = 0.35
      far.connect(ambBus)
      if (r < 0.5) for (const f of [392, 494]) tone({ type: 'sawtooth', f: f * (0.8 + Math.random() * 0.5), a: 0.02, d: 0.14 + Math.random() * 0.25, v: 0.1, bus: far })
      else if (r < 0.75) for (let i = 0; i < 3; i++) tone({ type: 'square', f: 300 + Math.random() * 250, t: i * 0.09, d: 0.06, v: 0.05, bus: far })
      else if (r < 0.9) tone({ type: 'sine', f: 1568, d: 0.5, v: 0.05, bus: far })
      else noise({ a: 0.3, d: 1.2, v: 0.18, f: 300, bus: far }) // a lorry passing
      setTimeout(() => far.disconnect(), 3000)
    }
    amb.timer = setTimeout(life, 2500 + Math.random() * 6000)
  }
  life()
  // chatter swells a little, like a real crowd
  amb.swell = setInterval(() => {
    if (ctx.state !== 'running') return
    amb.chatter.g.gain.setTargetAtTime(state.amb.street * (0.03 + Math.random() * 0.05), ctx.currentTime, 0.8)
    amb.chatter.filt.frequency.setTargetAtTime(800 + Math.random() * 700, ctx.currentTime, 1.2)
  }, 1800)
}

export function setAmbience(next) {
  Object.assign(state.amb, next)
  if (!ctx) return
  const t = ctx.currentTime
  amb.rumble.g.gain.setTargetAtTime(state.amb.street * 0.5, t, 0.6)
  amb.rain.g.gain.setTargetAtTime(state.amb.rain * 0.22, t, 0.8)
  amb.gen.g.gain.setTargetAtTime(state.amb.night * state.amb.street * 0.1, t, 1)
}

// ---------- engine (driving) ----------
let eng = null
export function engine(speed) {
  if (!ctx) return
  if (speed == null) {
    if (eng) {
      eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
      const e = eng
      setTimeout(() => {
        e.o1.stop()
        e.o2.stop()
      }, 500)
      eng = null
    }
    return
  }
  if (!eng) {
    const o1 = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    o1.type = 'sawtooth'
    o2.type = 'square'
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400
    const g = ctx.createGain()
    g.gain.value = 0
    o1.connect(lp)
    o2.connect(lp)
    lp.connect(g).connect(sfxBus)
    o1.start()
    o2.start()
    eng = { o1, o2, lp, g }
  }
  const t = ctx.currentTime
  const f = 48 + speed * 95
  eng.o1.frequency.setTargetAtTime(f, t, 0.08)
  eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.08)
  eng.lp.frequency.setTargetAtTime(300 + speed * 900, t, 0.1)
  eng.g.gain.setTargetAtTime(0.1 + speed * 0.08, t, 0.1)
}

// ---------- music: a tiny step sequencer ----------
// 16 steps per bar. Patterns are strings: 'x' = hit, '.' = rest.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12)
const MOODS = {
  // highlife: bright, bouncy, major pentatonic guitar over I–IV–I–V
  street: {
    bpm: 108,
    kick: 'x.....x...x.....',
    rim: '....x.......x...',
    shaker: 'x.xxx.xxx.xxx.xx',
    bell: 'x..x..x...x.x...',
    chords: [57, 62, 57, 64], // A D A E (roots, MIDI)
    bass: 'x..x..x.....x.x.',
    bassNotes: [0, 0, 7, 0, 12, 7],
    lead: 'x.x..x.x.x..x.x.',
    scale: [0, 2, 4, 7, 9, 12, 14, 16],
    leadWave: 'triangle',
  },
  night: {
    bpm: 84,
    kick: 'x.........x.....',
    rim: '....x.......x...',
    shaker: '..x...x...x...x.',
    bell: '',
    chords: [57, 54, 62, 64], // A F#m D E
    bass: 'x.......x.....x.',
    bassNotes: [0, 0, 7],
    lead: 'x...x..x....x...',
    scale: [0, 2, 4, 7, 9, 12],
    leadWave: 'sine',
  },
  tension: {
    bpm: 132,
    kick: 'x...x...x...x...',
    rim: '....x.......x.x.',
    shaker: 'xxxxxxxxxxxxxxxx',
    bell: 'x.x...x.x...x...',
    chords: [57, 57, 55, 53], // Am Am G F
    bass: 'x.xx..x.x.xx..x.',
    bassNotes: [0, 0, 12, 0, 0, 10, 0, 7],
    lead: '..x...x...x..x..',
    scale: [0, 3, 5, 7, 10, 12],
    leadWave: 'square',
  },
  drive: {
    bpm: 118,
    kick: 'x..x..x.x..x..x.',
    rim: '....x.......x...',
    shaker: 'x.x.x.x.x.x.x.x.',
    bell: '..x..x....x..x..',
    chords: [62, 67, 62, 69], // D G D A
    bass: 'x..x..x.x..x..x.',
    bassNotes: [0, 7, 12, 0, 7, 12, 10],
    lead: 'x..x.x..x..x.x..',
    scale: [0, 2, 4, 7, 9, 12, 14],
    leadWave: 'triangle',
  },
  menu: {
    bpm: 96,
    kick: 'x.....x.........',
    rim: '',
    shaker: '..x...x...x...x.',
    bell: 'x..x..x...x.x...',
    chords: [57, 62, 57, 64],
    bass: 'x.....x...x.....',
    bassNotes: [0, 7, 0],
    lead: 'x.x..x....x.x...',
    scale: [0, 4, 7, 9, 12, 16],
    leadWave: 'sine',
  },
}

const seq = { step: 0, next: 0, timer: null, leadIdx: 0, seed: 7 }
const rnd = () => ((seq.seed = (seq.seed * 9301 + 49297) % 233280) / 233280)

function drum(kind, t) {
  if (kind === 'kick') tone({ type: 'sine', f: 130, to: 45, t, a: 0.002, d: 0.16, v: 0.75, bus: musicBus })
  else if (kind === 'rim') noise({ t, d: 0.07, v: 0.3, type: 'bandpass', f: 1700, q: 2.5, bus: musicBus })
  else if (kind === 'shaker') noise({ t, d: 0.03, v: 0.1, type: 'highpass', f: 6500, bus: musicBus })
  else if (kind === 'bell') tone({ type: 'square', f: 1100, t, d: 0.05, v: 0.07, bus: musicBus })
}

function schedule(m, step, when) {
  const t = when - ctx.currentTime
  const s = step % 16
  const bar = Math.floor(step / 16) % m.chords.length
  const root = m.chords[bar]
  if (m.kick[s] === 'x') drum('kick', t)
  if (m.rim[s] === 'x') drum('rim', t)
  if (m.shaker[s] === 'x') drum('shaker', t)
  if (m.bell[s] === 'x') drum('bell', t)
  if (m.bass[s] === 'x') {
    const n = m.bassNotes[Math.floor(rnd() * m.bassNotes.length)]
    tone({ type: 'triangle', f: NOTE(root - 24 + n), t, a: 0.005, d: 0.2, v: 0.5, bus: musicBus })
  }
  if (m.lead[s] === 'x') {
    // wander up and down the scale: sounds like a guitar line, never the same twice
    seq.leadIdx = Math.max(0, Math.min(m.scale.length - 1, seq.leadIdx + Math.floor(rnd() * 5) - 2))
    const n = root + m.scale[seq.leadIdx]
    tone({ type: m.leadWave, f: NOTE(n), t, a: 0.004, d: 0.2, v: 0.2, bus: musicBus })
    tone({ type: m.leadWave, f: NOTE(n + 12), t: t + 0.01, a: 0.004, d: 0.12, v: 0.06, bus: musicBus })
  }
  // a soft chord on the first beat of each bar
  if (s === 0) for (const k of [0, 4, 7]) tone({ type: 'sine', f: NOTE(root + (k === 4 && m.leadWave === 'square' ? 3 : k)), t, a: 0.03, d: 0.9, v: 0.08, bus: musicBus })
}

function startSequencer() {
  seq.timer = setInterval(() => {
    const m = MOODS[state.mood]
    if (!m || !state.music || ctx.state !== 'running') {
      seq.next = 0
      return
    }
    const spb = 60 / m.bpm / 4
    if (seq.next < ctx.currentTime) seq.next = ctx.currentTime + 0.05
    while (seq.next < ctx.currentTime + 0.25) {
      schedule(m, seq.step, seq.next)
      seq.step++
      seq.next += spb
    }
  }, 90)
}

export function setMusic(mood) {
  state.wantMood = mood
  if (!ctx || state.mood === mood) return
  state.mood = mood
  seq.step = 0
  seq.next = 0
}

export const MUSIC_MOODS = Object.keys(MOODS)
