import { describe, it, expect } from 'vitest'
import { findsFor, collectFind, findsKey } from './finds.js'
import { getLayout } from '../world/worlds.js'
import FINDS from '../data/finds.json'
import { STAT_DEFS } from '../narrative/stats.js'

const game = (over = {}) => ({ campaign: 'areaBoy', story: { chapterId: 'ch2_rules' }, stats: { day: 3, money: 0, energy: 50 }, ...over })

describe('street finds', () => {
  for (const world of ['iyanaWahala', 'nkwoAgu', 'royalCrest']) {
    it(`${world}: places finds on open ground, the same every time`, () => {
      const layout = getLayout(world)
      const a = findsFor(layout, game())
      expect(a.length).toBeGreaterThanOrEqual(4)
      expect(findsFor(layout, game())).toEqual(a)
      for (const f of a) {
        expect(f.x).toBeGreaterThan(layout.bounds.minX)
        expect(f.x).toBeLessThan(layout.bounds.maxX)
        for (const s of Object.values(layout.spots)) expect(Math.hypot(s.pos[0] - f.x, s.pos[1] - f.z)).toBeGreaterThanOrEqual(3)
      }
    })
  }

  it('new day, new finds', () => {
    const layout = getLayout('iyanaWahala')
    expect(findsKey('iyanaWahala', game())).not.toBe(findsKey('iyanaWahala', game({ stats: { day: 4 } })))
    expect(findsFor(layout, game({ stats: { day: 4 } }))).not.toEqual(findsFor(layout, game()))
  })

  it('a find can be collected once', () => {
    const layout = getLayout('iyanaWahala')
    const g = game()
    const [first] = findsFor(layout, g)
    const r = collectFind(first, layout.id, g)
    expect(r.text).not.toContain('{amount}')
    expect(Object.keys(r.effects.changeStat).length).toBeGreaterThan(0)
    const after = { ...g, finds: r.finds }
    expect(collectFind(first, layout.id, after)).toBeNull()
    expect(findsFor(layout, after).some((f) => f.id === first.id)).toBe(false)
    expect(r.finds.total).toBe(1)
  })

  it('only gives things the campaign has, and only real stats', () => {
    for (const k of Object.values(FINDS.kinds)) for (const s of Object.keys(k.stats || {})) expect(STAT_DEFS[s], s).toBeTruthy()
    const layout = getLayout('nkwoAgu')
    for (let day = 1; day < 30; day++) {
      for (const f of findsFor(layout, game({ campaign: 'grace', stats: { day } }))) expect(['note', 'bigNote', 'kola']).toContain(f.kind)
    }
  })
})
