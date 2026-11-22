import { describe, it, expect } from 'vitest'

// Cross-references between the story, the worlds and the game data. A name
// typed wrong in a JSON file (a fighter, a driver, a quiz bank, a scene to
// jump to) is caught here instead of in someone's play-through.
import fighters from './fighters.json'
import bluffs from './bluffs.json'
import quizzes from './quizzes.json'
import routes from './routes.json'
import jobs from './jobs.json'
import drivers from './drivers.json'
import characters from './characters.json'
import registrySource from '../modes/modeRegistry.js?raw'
import { GOODS } from '../modes/haggle/haggleLogic.js'
import runnerSource from '../modes/runner/RunnerScene.jsx?raw'

const chapters = import.meta.glob('./story/**/*.json', { eager: true, import: 'default' })
const worlds = import.meta.glob('./world/*.json', { eager: true, import: 'default' })

// names declared in code, read from the source so this test needs no 3D imports
const keysOf = (src, name) => [...src.slice(src.indexOf(`${name} = {`)).split('\n}')[0].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
// the arcade mini-games are spread into MODES from arcade/index.js: their ids are in each game file
const arcadeIds = Object.values(import.meta.glob(['../modes/arcade/games/*.js', '../modes/platformer/escape.js'], { eager: true, query: '?raw', import: 'default' })).map((src) => src.match(/^\s*id: '(\w+)'/m)?.[1]).filter(Boolean)
const MODES = new Set([...keysOf(registrySource, 'MODES'), ...arcadeIds])
const CHASERS = new Set(keysOf(runnerSource, 'CHASERS'))
const SPOTS = new Set(Object.values(worlds).flatMap((w) => Object.keys(w.spots || {})))

// every mode use: { mode, params, where }
function modeUses() {
  const out = []
  const walk = (o, where) => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${where}[${i}]`))
    if (!o || typeof o !== 'object') return
    if (typeof o.mode === 'string') out.push({ mode: o.mode, params: o.params || {}, where })
    if (typeof o.startMode === 'string') out.push({ mode: o.startMode, params: o.params || o.modeParams || {}, where })
    for (const [k, v] of Object.entries(o)) walk(v, `${where}.${k}`)
  }
  for (const [file, ch] of Object.entries(chapters)) walk(ch, file)
  for (const [file, w] of Object.entries(worlds)) walk(w.activities || [], `${file} activities`)
  return out
}

describe('data cross-references', () => {
  const uses = modeUses()

  it('finds the mode registry and the runner chasers', () => {
    expect(MODES.has('fight')).toBe(true)
    expect(CHASERS.has('taskForce')).toBe(true)
    expect(uses.length).toBeGreaterThan(30)
  })

  it('every mode used in a story or world is a real mode', () => {
    // "travel" is the open world's bus between places (gameStore.startActivity), not a game
    const bad = uses.filter((u) => !MODES.has(u.mode) && u.mode !== 'travel').map((u) => `${u.where}: "${u.mode}"`)
    expect(bad).toEqual([])
  })

  it('every mode parameter names something that exists', () => {
    const bad = []
    const need = (ok, u, what) => ok || bad.push(`${u.where}: ${u.mode} ${what}`)
    for (const u of uses) {
      const p = u.params
      if (u.mode === 'fight' && p.opponent) need(fighters[p.opponent], u, `opponent "${p.opponent}"`)
      if (u.mode === 'bluff') need(bluffs.scenarios[p.scenario], u, `scenario "${p.scenario}"`)
      if ((u.mode === 'exam' || u.mode === 'initiation') && p.bank) need(quizzes[p.bank], u, `bank "${p.bank}"`)
      if (u.mode === 'conductor') {
        if (p.route) need(routes.routes[p.route], u, `route "${p.route}"`)
        for (const n of p.named || []) need(routes.named[n], u, `named passenger "${n}"`)
      }
      if (u.mode === 'rally' && p.job) need(jobs.rally.jobs[p.job], u, `job "${p.job}"`)
      if (u.mode === 'begging' && p.wrongPerson) need(jobs.begging.wrong[p.wrongPerson], u, `wrongPerson "${p.wrongPerson}"`)
      if (u.mode === 'feeCollection') {
        if (p.defaulter) need(drivers.named[p.defaulter], u, `defaulter "${p.defaulter}"`)
        for (const d of p.drivers || []) need(drivers.named[d], u, `driver "${d}"`)
        if (p.spot) need(SPOTS.has(p.spot), u, `spot "${p.spot}"`)
      }
      // a chase after someone who isn't a named driver must say who it is
      if (u.mode === 'chase' && p.target) need(drivers.named[p.target.replace('driver_', '')] || p.name, u, `target "${p.target}" (not a named driver and no "name")`)
      if (u.mode === 'haggle') need(GOODS[p.goods], u, `goods "${p.goods}"`)
      if (u.mode === 'runner' && p.chaser) need(CHASERS.has(p.chaser), u, `chaser "${p.chaser}"`)
    }
    expect(bad).toEqual([])
  })

  it('every world NPC with a character id has that character', () => {
    const bad = []
    for (const [file, w] of Object.entries(worlds))
      for (const n of w.npcs || []) if (n.character && !characters[n.character]) bad.push(`${file}: npc ${n.id} -> "${n.character}"`)
    expect(bad).toEqual([])
  })

  it('every scene "positions" entry is a known character or NPC', () => {
    const npcIds = new Set(Object.values(worlds).flatMap((w) => (w.npcs || []).map((n) => n.id)))
    const bad = []
    for (const [file, ch] of Object.entries(chapters))
      for (const [sid, s] of Object.entries(ch.scenes || {}))
        for (const who of Object.keys(s.positions || {})) if (!characters[who] && !npcIds.has(who) && who !== 'player') bad.push(`${file} ${sid}: "${who}"`)
    expect(bad).toEqual([])
  })

  it('everyone a scene sends you to talk to stands in that world (or is placed by the scene)', () => {
    const npcsOf = Object.fromEntries(Object.values(worlds).map((w) => [w.id, new Set((w.npcs || []).map((n) => n.id))]))
    const bad = []
    const goals = (o, out = []) => {
      if (Array.isArray(o)) o.forEach((v) => goals(v, out))
      else if (o && typeof o === 'object') {
        if (o.type === 'freeRoam' && o.goal?.talkTo) out.push(o.goal.talkTo)
        Object.values(o).forEach((v) => goals(v, out))
      }
      return out
    }
    for (const [file, ch] of Object.entries(chapters))
      for (const [sid, s] of Object.entries(ch.scenes || {})) {
        const world = s.world || ch.world || 'iyanaWahala'
        for (const who of goals(s.beats)) if (!s.positions?.[who] && !npcsOf[world]?.has(who)) bad.push(`${file} ${sid}: talk to "${who}", who isn't in ${world}`)
      }
    expect(bad).toEqual([])
  })
})
