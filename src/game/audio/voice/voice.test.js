import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { VOICE_LINES, voiceIdsOf } from './voice.js'
import script from '../../../../scripts/voice/lines.json'

describe('recorded voice lines', () => {
  it('every line in the script was rendered, with its file, kind and length', () => {
    expect(Object.keys(VOICE_LINES).sort()).toEqual(script.segments.map((s) => s.id).sort())
    for (const [id, l] of Object.entries(VOICE_LINES)) {
      expect(fs.existsSync(`public/assets/${l.file}`), id).toBe(true)
      expect(l.duration, id).toBeGreaterThan(0.5)
      expect(['briefing', 'raid', 'chant', 'callout', 'radio', 'announce']).toContain(l.kind)
    }
  })
  it('the game asks only for lines that exist', () => {
    const src = ['src/game/modes/stealth/StealthDirector.jsx', 'src/game/modes/stealth/StealthMode.jsx', 'src/game/modes/chase/ChaseMode.jsx', 'src/game/audio/AudioDirector.jsx'].map((f) => fs.readFileSync(f, 'utf8')).join('\n')
    const asked = [...src.matchAll(/'((?:brief|raid|chant|callout|radio|announce)_[A-Za-z]+)'/g)].map((m) => m[1])
    expect(asked.length).toBeGreaterThan(5)
    for (const id of asked) expect(VOICE_LINES[id], id).toBeTruthy()
    expect(voiceIdsOf('radio').length).toBeGreaterThanOrEqual(3)
  })
})
