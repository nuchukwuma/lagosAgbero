// Checks every story JSON file for mistakes. Run after editing the story:
//   npm run story:check
//
// It also "plays" every chapter many times with random choices and random
// mode outcomes, to catch dead ends (a path that can never finish).

import fs from 'node:fs'
import path from 'node:path'
import { validateStory } from '../src/game/narrative/validateStory.js'
import * as engine from '../src/game/narrative/storyEngine.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DATA = path.join(ROOT, 'src/game/data')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.json') ? [path.join(dir, d.name)] : []))
}

const chapters = {}
let parseErrors = 0
for (const file of walk(path.join(DATA, 'story'))) {  // chapters only
  try {
    const ch = readJson(file)
    chapters[ch.id] = ch
  } catch (e) {
    parseErrors++
    console.error(`✗ ${path.relative(ROOT, file)}: not valid JSON — ${e.message}`)
  }
}

const ctx = {
  chapters,
  characters: readJson(path.join(DATA, 'characters.json')),
  callbacks: readJson(path.join(DATA, 'callbacks.json')),
  endings: readJson(path.join(DATA, 'endings.json')),
}

const worldJson = readJson(path.join(DATA, 'world/iyanaWahala.json'))
const world = { spots: Object.keys(worldJson.spots || {}), npcs: (worldJson.npcs || []).map((n) => n.id) }

const { errors, warnings } = validateStory({ ...ctx, modes: [], world })
for (const w of warnings) console.warn(`! ${w}`)
for (const e of errors) console.error(`✗ ${e}`)

// Random play-throughs.
let playErrors = 0
if (!errors.length) {
  for (const chapterId of Object.keys(chapters)) {
    for (let run = 0; run < 200; run++) {
      let state = engine.newGameState({ name: 'Tester' })
      try {
        state = engine.startChapter(ctx, state, chapterId).state
        for (let step = 0; step < 2000; step++) {
          const view = engine.renderView(ctx, state)
          if (view.type === 'ending' || view.type === 'finished') break
          if (view.type === 'chapterEnd' && state.story.chapterId !== chapterId) break
          if (view.type === 'choice') {
            const open = view.options.filter((o) => !o.locked)
            if (!open.length) throw new Error(`every option locked at ${view.key}`)
            state = engine.choose(ctx, state, open[Math.floor(Math.random() * open.length)].index).state
          } else if (view.type === 'mode') {
            const outcomes = view.outcomes.length ? view.outcomes : ['won', 'lost']
            state = engine.receiveModeResult(ctx, state, { outcome: outcomes[Math.floor(Math.random() * outcomes.length)] }).state
          } else {
            state = engine.advance(ctx, state).state
          }
          if (step === 1999) throw new Error('never reached an end after 2000 steps')
        }
      } catch (e) {
        playErrors++
        console.error(`✗ play-through of "${chapterId}": ${e.message}`)
        break
      }
    }
  }
}

const total = errors.length + parseErrors + playErrors
console.log(`\n${Object.keys(chapters).length} chapter(s), ${errors.length + parseErrors} error(s), ${warnings.length} warning(s), ${playErrors} play-through failure(s)`)
if (total) process.exit(1)
console.log('Story OK ✓')
