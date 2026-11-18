import { describe, it, expect } from 'vitest'
import { effectiveQuality, renderProfile, QUALITY_LEVELS } from './settings.js'

describe('graphics levels', () => {
  it('has four levels, each sharper than the last', () => {
    expect(QUALITY_LEVELS).toEqual(['low', 'medium', 'high', 'sharpest'])
    const far = QUALITY_LEVELS.map((q) => renderProfile(q).far)
    expect([...far].sort((a, b) => a - b)).toEqual(far)
    expect(renderProfile('low').antialias).toBe(false)
  })
  it('old and unset choices map to a level', () => {
    expect(['low', 'medium']).toContain(effectiveQuality('auto'))
    expect(['low', 'medium']).toContain(effectiveQuality(undefined))
    expect(effectiveQuality('high')).toBe('high') // the old "Sharp"
    expect(effectiveQuality('low')).toBe('low') // the old "Light"
  })
})
