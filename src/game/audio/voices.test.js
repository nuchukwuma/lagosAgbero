import { describe, it, expect } from 'vitest'
import characters from '../data/characters.json'
import { isFemale } from '../characters/look.js'
import { spokenText, voiceProfile } from './voices.js'

describe('spoken dialogue', () => {
  it('reads money, drops markup and stage directions, strips accent marks', () => {
    expect(spokenText('Bring ₦2,000 *now* (he spits)!')).toBe('Bring 2,000 naira now !')
    expect(spokenText('Ṣàngóbíyìí… oya')).toBe('Sangobiyii... oya')
  })

  it('gives every character their own voice', () => {
    const placed = []
    for (const id of Object.keys(characters)) {
      const { pitch, rate } = voiceProfile(id)
      const twin = placed.find((o) => Math.abs(o.pitch - pitch) < 0.025 && Math.abs(o.rate - rate) < 0.025)
      expect(twin?.id, `${id} sounds like ${twin?.id}`).toBeUndefined()
      placed.push({ id, pitch, rate })
    }
  })

  it('women speak higher than men', () => {
    const avg = (ids) => ids.reduce((s, id) => s + voiceProfile(id).pitch, 0) / ids.length
    const ids = Object.keys(characters)
    const women = ids.filter((id) => isFemale(characters[id].look?.body))
    const men = ids.filter((id) => !isFemale(characters[id].look?.body))
    expect(avg(women)).toBeGreaterThan(avg(men) + 0.2)
  })
})
