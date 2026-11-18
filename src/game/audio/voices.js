// Spoken dialogue, for players who'd rather listen than read. Uses the voices
// built into the phone or browser (the Web Speech API), so nothing is
// downloaded and it costs no memory.
//
// Every character sounds different: each gets one of the device's voices
// (Nigerian English first, when the device has it), a pitch and a speed,
// set by who they are (an elder speaks low and slow, a hustler fast) plus a
// a personal touch, spread so that no two of the cast match.
// A character can set its own in characters.json: "voice": { "pitch": 0.8, "rate": 0.9 }.
//
//   speak(text, speaker, { look, onDone })   stopSpeaking()   voicesSupported()

import characters from '../data/characters.json'
import { isFemale } from '../characters/look.js'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
export const voicesSupported = () => Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function')

// how each kind of person talks: pitch and speed changes from the usual
const ROLE_STYLE = {
  mentor: { pitch: -0.12, rate: -0.08 },
  chairman: { pitch: -0.15, rate: -0.06 },
  elder: { pitch: -0.18, rate: -0.12 },
  seer: { pitch: -0.2, rate: -0.14 },
  tapper: { pitch: -0.1, rate: -0.1 },
  uncle: { pitch: -0.08, rate: -0.04 },
  vc: { pitch: -0.1, rate: -0.08 },
  priest: { pitch: -0.08, rate: -0.1 },
  preacher: { pitch: 0.02, rate: -0.04 },
  politician: { pitch: -0.06, rate: -0.05 },
  villain: { pitch: -0.16, rate: -0.08 },
  tortoiseBoss: { pitch: -0.14, rate: -0.06 },
  hyenaBoss: { pitch: -0.1, rate: 0.04 },
  lecturer: { pitch: -0.04, rate: -0.06 },
  taskForce: { pitch: -0.1, rate: 0.02 },
  security: { pitch: -0.08, rate: -0.02 },
  creditor: { pitch: 0.04, rate: 0.06 },
  mother: { pitch: -0.05, rate: -0.04 },
  family: { pitch: -0.05, rate: -0.05 },
  foodSeller: { pitch: 0.04, rate: 0.06 },
  hustler: { pitch: 0.04, rate: 0.12 },
  scammer: { pitch: 0.06, rate: 0.14 },
  okadaRider: { pitch: 0.05, rate: 0.14 },
  jokeSeller: { pitch: 0.1, rate: 0.1 },
  sidekick: { pitch: 0.08, rate: 0.1 },
  rivalBoy: { pitch: 0.06, rate: 0.1 },
  hyena: { pitch: 0.1, rate: 0.12 },
  roommate: { pitch: 0.06, rate: 0.08 },
  coursemate: { pitch: 0.06, rate: 0.06 },
  richFriend: { pitch: 0.02, rate: -0.02 },
  app: { pitch: 0.15, rate: 0.1 },
}

// Each character's own pitch and speed, on top of their sex's usual voice:
// their kind of person (ROLE_STYLE), their size, and a personal touch spread
// evenly over the cast (golden-ratio steps). Anyone who'd still sound like
// someone already placed is nudged apart, so no two of the cast match.
/** A woman's voice? From the body, or "voice": { "sex": "female" } for someone heard but not seen. */
const isFemaleVoice = (c, look) => (c?.voice?.sex ? c.voice.sex === 'female' : isFemale(look?.body || c?.look?.body))

const TUNING = new Map() // id -> { pitch, rate } (offsets)
const placed = [] // compared at the usual base pitch of each sex, so a deep woman and a high man stay apart too
for (const female of [false, true]) {
  const base = female ? 1.3 : 0.88
  Object.keys(characters)
    .filter((id) => isFemaleVoice(characters[id]) === female)
    .sort()
    .forEach((id, i) => {
      const c = characters[id]
      const style = ROLE_STYLE[c.role] || { pitch: 0, rate: 0 }
      const tall = (c.look?.height || 1) - 1 // taller and bigger: a little deeper
      // who they are sets the voice; the personal touch only colours it. Kept
      // within a quarter either way: much lower or higher and voices turn robotic
      let pitch = Math.max(-0.22, Math.min(0.22, style.pitch + (((i * 0.618034) % 1) - 0.5) * 0.14 - tall * 0.6))
      let rate = style.rate + (((i * 0.381966 + 0.5) % 1) - 0.5) * 0.12
      // too close to someone already placed: talk a little faster or slower (or, failing that, higher)
      const near = () => placed.some((o) => Math.abs(o.pitch - (base + pitch)) < 0.03 && Math.abs(o.rate - rate) < 0.03)
      const start = rate
      for (let n = 1; n <= 12 && near(); n++) {
        rate = Math.max(-0.2, Math.min(0.3, start + (n % 2 ? 1 : -1) * 0.035 * Math.ceil(n / 2)))
        if (n > 6) pitch = Math.max(-0.25, Math.min(0.25, pitch + 0.035))
      }
      placed.push({ pitch: base + pitch, rate })
      TUNING.set(id, { pitch, rate })
    })
}

function hash(s) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100003
  return h
}

// ---- the device's voices ----
// Accents in order of preference: Nigerian English first, then its neighbours.
const ACCENTS = ['en-NG', 'en-GH', 'en-KE', 'en-ZA', 'en-GB', 'en-IN', 'en-AU', 'en-US', 'en']
const FEMALE_NAMES = /female|woman|ezinne|samantha|victoria|karen|moira|tessa|fiona|veena|zira|hazel|susan|linda|heera|libby|sonia|natasha|jenny|aria|michelle|leah|asilia|luna|clara|emily|serena|kate|allison|ava|nicky|salli|joanna|kimberly|ivy|amy|emma|olivia|catherine|isla|neerja|maisie|aoife|yan/i
const MALE_NAMES = /\bmale\b|\bman\b|abeo|daniel|alex|fred|oliver|rishi|david|mark|george|ryan|william|guy|eric|christopher|luke|thomas|arthur|gordon|aaron|tom|james|brian|joey|justin|matthew|russell|prabhat|connor|liam|elliot|chilemba|rehema|tony/i

let cached = null
function deviceVoices() {
  if (cached) return cached
  const all = (synth?.getVoices() || []).filter((v) => /^en/i.test(v.lang))
  if (!all.length) return null // not loaded yet (Chrome loads them a moment after start)
  const accentOf = (v) => {
    const lang = v.lang.replace('_', '-')
    const i = ACCENTS.findIndex((a) => lang.toLowerCase().startsWith(a.toLowerCase()))
    return i < 0 ? ACCENTS.length : i
  }
  const sexOf = (v) => (FEMALE_NAMES.test(v.name) ? 'female' : MALE_NAMES.test(v.name) ? 'male' : null)
  cached = all.map((v) => ({ voice: v, accent: accentOf(v), sex: sexOf(v), local: v.localService }))
  return cached
}
if (synth) synth.addEventListener?.('voiceschanged', () => (cached = null))

/** The voices fit for someone: the best accent the device has, their sex where known. */
function poolFor(sex) {
  const voices = deviceVoices()
  if (!voices) return []
  const fits = (v) => v.sex === sex || v.sex === null
  const ranked = voices.filter(fits)
  const list = ranked.length ? ranked : voices
  const best = Math.min(...list.map((v) => v.accent))
  let pool = list.filter((v) => v.accent === best)
  // too few to tell people apart: add the next accent along (but a Nigerian
  // or Ghanaian voice is worth more than variety: pitch and speed tell people apart)
  if (pool.length < 3 && best > 1) {
    const next = Math.min(...list.filter((v) => v.accent > best).map((v) => v.accent), Infinity)
    pool = pool.concat(list.filter((v) => v.accent === next))
  }
  // a voice of the right sex before one we can't tell
  return [...pool.filter((v) => v.sex === sex), ...pool.filter((v) => v.sex !== sex)].map((v) => v.voice)
}

/** How a speaker sounds: { voice, pitch, rate }. */
export function voiceProfile(speaker, look) {
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
  if (!speaker || speaker === 'narrator') {
    const pool = poolFor('male')
    return { voice: pool[0] || null, pitch: 1, rate: 0.95, narrator: true }
  }
  const c = characters[speaker]
  const sex = isFemaleVoice(c, look) ? 'female' : 'male'
  const h = hash(speaker)
  const pool = poolFor(sex)
  // characters spread over the pool
  const pick = h % Math.max(1, pool.length)
  // voices we can't tell are male or female get pushed there by pitch
  const known = pool[pick] && (FEMALE_NAMES.test(pool[pick].name) || MALE_NAMES.test(pool[pick].name))
  const base = sex === 'female' ? (known ? 1.1 : 1.3) : known ? 0.95 : 0.88
  // the player and anyone not in the cast: from their name and size
  const own = TUNING.get(speaker) || { pitch: ((h % 13) - 6) / 50 - ((look?.height || 1) - 1) * 0.8, rate: (((h >> 4) % 7) - 3) / 50 }
  const pitch = clamp(c?.voice?.pitch ?? base + own.pitch, 0.6, 1.8)
  const rate = clamp(c?.voice?.rate ?? 1 + own.rate, 0.75, 1.35)
  return { voice: pool[pick] || null, pitch, rate }
}

/** Text as it should be spoken: no markup, money read out, names without accent marks. */
export function spokenText(text) {
  return String(text || '')
    .replace(/₦\s?([\d,]+(?:\.\d+)?)(k?)/gi, (_, n, k) => `${n}${k ? ' thousand' : ''} naira`)
    .replace(/\(([^)]*)\)|\[[^\]]*\]/g, '') // stage directions
    .replace(/[*_~`#]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // Ṣàngóbíyìí -> Sangobiyii: English voices read it more kindly
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Short pieces: some browsers cut off an utterance after ~15 seconds. */
function pieces(text) {
  const parts = text.match(/[^.!?]+[.!?]*["”']?\s*/g) || [text]
  const out = []
  for (const p of parts) {
    if (out.length && (out[out.length - 1] + p).length < 160) out[out.length - 1] += p
    else out.push(p)
  }
  return out.map((p) => p.trim()).filter(Boolean)
}

let session = 0
let speakingNow = false
const listeners = new Set()
/** Called with true / false when speech starts and stops (to quieten the music). */
export function onSpeaking(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function setSpeaking(on) {
  if (on === speakingNow) return
  speakingNow = on
  for (const fn of listeners) fn(on)
}

export function stopSpeaking() {
  session++
  if (synth && (synth.speaking || synth.pending)) synth.cancel()
  setSpeaking(false)
}

/**
 * Say a line in the speaker's voice. `onDone` runs once it has been said in
 * full (not when it's cut short by the next line or stopSpeaking).
 * Returns false when the device can't speak.
 */
export function speak(text, speaker, { look, onDone } = {}) {
  if (!voicesSupported()) return false
  stopSpeaking()
  const said = spokenText(text)
  if (!said) return false
  const id = session
  const { voice, pitch, rate } = voiceProfile(speaker, look)
  const parts = pieces(said)
  let i = 0
  const next = () => {
    if (id !== session) return
    if (i >= parts.length) {
      setSpeaking(false)
      onDone?.()
      return
    }
    const u = new window.SpeechSynthesisUtterance(parts[i++])
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else u.lang = 'en-NG'
    u.pitch = pitch
    u.rate = rate
    u.onend = next
    u.onerror = (e) => {
      // "interrupted"/"canceled" = we moved on; anything else, give up quietly
      if (id === session && e.error !== 'interrupted' && e.error !== 'canceled') setSpeaking(false)
    }
    synth.speak(u)
  }
  setSpeaking(true)
  // Chrome sometimes leaves the queue paused after cancel()
  if (synth.paused) synth.resume()
  next()
  return true
}
