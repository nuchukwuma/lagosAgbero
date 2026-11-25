// Renders the recorded voice lines (scripts/voice/lines.json) with skill-tts,
// then squeezes each into a small mono MP3 for the web:
//   public/assets/voice/<id>.mp3  and  src/game/audio/voice/voiceLines.json
//
//   TTS=/path/to/skill-tts/skills/tts/scripts/tts node scripts/render-voices.mjs
//
// The voice is skill-tts's "system" provider: espeak-ng, free and local (the
// choice for now; a paid provider is one line in lines.json: "provider").
// Unchanged lines are reused from skill-tts's own cache, so re-runs are quick.
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const TTS = process.env.TTS || 'tts'
const SCRIPT = 'scripts/voice/lines.json'
const OUT = 'public/assets/voice'
const MANIFEST = 'src/game/audio/voice/voiceLines.json'

const script = JSON.parse(fs.readFileSync(SCRIPT, 'utf8'))
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'voices-'))
// skill-tts takes only its own fields: the game's notes (kind) stay here
const ttsScript = path.join(work, 'script.json')
fs.writeFileSync(ttsScript, JSON.stringify({ ...script, segments: script.segments.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'kind'))) }))
const render = execFileSync(TTS, ['render', ttsScript, '-o', work, '--no-combine'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const result = JSON.parse(render.slice(render.indexOf('{')))

fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
const lines = {}
for (const seg of result.segments) {
  const def = script.segments.find((s) => s.id === seg.id)
  const file = `${seg.id}.mp3`
  // mono, 22 kHz, ~40 kbps: a short line is a few KB
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', seg.file, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', path.join(OUT, file)])
  lines[seg.id] = { file: `voice/${file}`, kind: def.kind, text: def.text, duration: Math.round(seg.duration * 100) / 100 }
}
fs.writeFileSync(MANIFEST, `${JSON.stringify({ provider: result.provider, lines }, null, 2)}\n`)
const kb = Object.keys(lines).reduce((a, id) => a + fs.statSync(path.join(OUT, `${id}.mp3`)).size, 0) / 1024
console.log(`${Object.keys(lines).length} lines, ${kb.toFixed(0)} KB in ${OUT}`)
fs.rmSync(work, { recursive: true, force: true })
