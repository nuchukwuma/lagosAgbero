// The story engine. Pure functions: (story data, state) -> { state, events }.
// No React, no browser APIs, so it is easy to test and to reason about.
//
// Story shape:  chapter -> scenes -> beats.  (Acts are a number on each chapter.)
// The pointer { chapterId, sceneId, beatIndex } always rests on a beat the
// player has to see or answer (dialogue, choice, news, cutscene, mode,
// chapter end). "Automatic" beats (setFlag, changeStat, randomEvent, goto)
// run instantly and are never rested on, so loading a save never repeats them.
//
// ctx = { chapters, callbacks, endings, characters }   (see storyData.js)

import { checkCondition, describeCondition } from './conditions.js'
import { applyEffects, resultToEffects } from './effects.js'
import { interpolate, pickVariant } from './text.js'
import { defaultStats, formatNaira } from './stats.js'
import { TIME_OF, phaseOf } from '../systems/clock.js'

const MAX_STEPS = 500
const INTERACTIVE = new Set(['dialogue', 'choice', 'newsBroadcast', 'cutscene', 'startMode', 'endChapter', 'freeRoam'])
const ADVANCEABLE = ['dialogue', 'newsBroadcast', 'cutscene', 'endChapter', 'freeRoam']

// Old 2D background names -> 3D location + time of day.
const LEGACY_BACKGROUNDS = {
  busStopDawn: { location: 'frontStop', time: 'dawn' },
  market: { location: 'market', time: 'day' },
  night: { location: 'underBridge', time: 'night' },
  underBridge: { location: 'underBridge', time: 'day' },
}

export function newGameState({ name = 'Tunde', nickname = 'JJC', look = null } = {}) {
  return {
    player: { name, nickname, look },
    stats: defaultStats(),
    flags: {},
    memory: {},
    time: TIME_OF.dawn, // minutes since midnight
    story: { chapterId: null, sceneId: null, beatIndex: 0, pendingMode: null, ending: null, completedChapters: [] },
  }
}

// ---------- lookups ----------
function chapterOf(ctx, id) {
  const ch = ctx.chapters[id]
  if (!ch) throw new Error(`Chapter "${id}" not found`)
  return ch
}

function sceneOf(ctx, story) {
  const scene = chapterOf(ctx, story.chapterId).scenes[story.sceneId]
  if (!scene) throw new Error(`Scene "${story.sceneId}" not found in chapter "${story.chapterId}"`)
  return scene
}

function currentBeat(ctx, state) {
  return sceneOf(ctx, state.story).beats[state.story.beatIndex]
}

/** "scene" or "chapter:scene" -> pointer */
function resolveTarget(target, story) {
  const [a, b] = String(target).split(':')
  return b ? { chapterId: a, sceneId: b, beatIndex: 0 } : { chapterId: story.chapterId, sceneId: a, beatIndex: 0 }
}

const withStory = (state, patch) => ({ ...state, story: { ...state.story, ...patch } })

// A scene with "time" moves the clock to that part of the day.
function withSceneTime(ctx, state) {
  const scene = ctx.chapters[state.story.chapterId]?.scenes?.[state.story.sceneId]
  const t = scene?.time && TIME_OF[scene.time]
  return t != null ? { ...state, time: t } : state
}
const nextBeat = (state) => withStory(state, { beatIndex: state.story.beatIndex + 1 })

function jump(ctx, state, target, events) {
  // "@resume": go back to where an interruption (collapse, raid...) happened
  if (target === '@resume') {
    const back = state.story.returnTo || state.story.checkpoint
    if (!back) throw new Error('Nothing to resume')
    events.push({ type: 'scene', ...back })
    return withStory(state, { chapterId: back.chapterId, sceneId: back.sceneId, beatIndex: back.beatIndex ?? 0, returnTo: null })
  }
  const p = resolveTarget(target, state.story)
  chapterOf(ctx, p.chapterId) // throws early on a bad target
  events.push({ type: 'scene', ...p })
  // every scene start in a normal chapter is a checkpoint to retry from
  const checkpoint = ctx.chapters[p.chapterId].common ? state.story.checkpoint : { chapterId: p.chapterId, sceneId: p.sceneId }
  return withSceneTime(ctx, withStory(state, { ...p, checkpoint }))
}

// ---------- callbacks & dialogue ----------
/** A dialogue beat's final speaker/text, or null if it should be skipped. */
function resolveDialogue(ctx, state, beat) {
  if (beat.callback) {
    const value = state.memory[beat.callback]
    const entry = ctx.callbacks?.[beat.callback]?.[value]
    const lines = entry ? (Array.isArray(entry) ? entry : [entry]) : []
    const line = lines.find((l) => checkCondition(l.if, state))
    if (!line) return null
    return { speaker: line.speaker, text: line.text, mood: line.mood }
  }
  return pickVariant(beat, state)
}

function speakerName(ctx, state, speaker) {
  if (!speaker || speaker === 'narrator') return null
  if (speaker === 'player') return state.player.name
  return ctx.characters?.[speaker]?.name ?? speaker
}

// ---------- flow ----------
/** After effects: follow ending / startMode / goto, else go to `fallback`. */
function followFlow(ctx, state, effects, fallback, events) {
  if (effects?.ending) return withStory(state, { ending: effects.ending, pendingMode: null })
  if (effects?.startMode) {
    const resume = effects.goto ? resolveTarget(effects.goto, state.story) : fallback
    events.push({ type: 'mode:start', mode: effects.startMode, params: effects.params || {} })
    return withStory(state, { pendingMode: { mode: effects.startMode, params: effects.params || {}, results: effects.results || null, resume } })
  }
  if (effects?.goto) return jump(ctx, state, effects.goto, events)
  return withStory(state, fallback)
}

function apply(state, effects, events) {
  const r = applyEffects(state, effects)
  for (const text of r.notices) events.push({ type: 'toast', text })
  return r.state
}

function pickWeighted(outcomes, state, random) {
  const pool = outcomes.filter((o) => checkCondition(o.if, state))
  const total = pool.reduce((s, o) => s + (o.weight ?? 1), 0)
  let roll = random() * total
  for (const o of pool) {
    roll -= o.weight ?? 1
    if (roll < 0) return o
  }
  return pool[pool.length - 1]
}

/** Runs automatic beats until reaching one the player must see. */
function run(ctx, state, events, random = Math.random) {
  for (let step = 0; step < MAX_STEPS; step++) {
    const { story } = state
    if (story.ending || story.pendingMode || !story.chapterId) return state
    const scene = sceneOf(ctx, story)
    const beat = scene.beats[story.beatIndex]

    if (!beat) {
      if (scene.next) { state = jump(ctx, state, scene.next, events); continue }
      throw new Error(`Scene "${story.sceneId}" ran out of beats. Add "next" to the scene or an endChapter beat.`)
    }
    if (!checkCondition(beat.if, state)) { state = nextBeat(state); continue }

    const here = { chapterId: story.chapterId, sceneId: story.sceneId, beatIndex: story.beatIndex + 1 }
    switch (beat.type) {
      case 'setFlag':
        state = nextBeat(apply(state, { setFlag: beat.flag ?? beat.flags, clearFlag: beat.clear }, events))
        continue
      case 'changeStat':
        state = nextBeat(apply(state, { changeStat: beat.stats }, events))
        continue
      case 'goto':
        state = jump(ctx, state, beat.scene, events)
        continue
      case 'randomEvent': {
        const outcome = pickWeighted(beat.outcomes || [], state, random)
        const effects = outcome?.effects
        state = followFlow(ctx, apply(state, effects, events), effects, here, events)
        continue
      }
      case 'dialogue':
        if (!resolveDialogue(ctx, state, beat)) { state = nextBeat(state); continue }
        return apply(state, beat.effects, events)
      case 'choice':
        if (!visibleOptions(state, beat).length) { state = nextBeat(state); continue }
        return state
      case 'startMode':
        events.push({ type: 'mode:start', mode: beat.mode, params: beat.params || {} })
        return withStory(state, { pendingMode: { mode: beat.mode, params: beat.params || {}, results: beat.results || null, resume: here } })
      case 'newsBroadcast':
      case 'cutscene':
      case 'endChapter':
      case 'freeRoam':
        return apply(state, beat.effects, events)
      default:
        throw new Error(`Unknown beat type "${beat.type}" in scene "${story.sceneId}"`)
    }
  }
  throw new Error('Story got stuck in a loop of automatic beats (check your goto targets).')
}

// ---------- choices ----------
function visibleOptions(state, beat) {
  return (beat.options || [])
    .map((opt, index) => {
      const meets = checkCondition(opt.requires, state)
      if (!meets && !opt.showLocked) return null
      // cost: a number, or "stat:quota" to charge whatever that stat is now
      const cost = typeof opt.cost === 'string' && opt.cost.startsWith('stat:') ? Math.round(state.stats[opt.cost.slice(5)] || 0) : opt.cost || 0
      const affordable = state.stats.money >= cost
      let lockedReason = null
      if (!meets) lockedReason = opt.lockedText || `Needs ${describeCondition(opt.requires)}`
      else if (!affordable) lockedReason = `You need ${formatNaira(cost)}`
      return { index, text: interpolate(opt.text, state), cost, locked: Boolean(lockedReason), lockedReason }
    })
    .filter(Boolean)
}

// ---------- public API ----------

/** Start (or jump to) a chapter. */
export function startChapter(ctx, state, chapterId, sceneId) {
  const events = []
  const chapter = chapterOf(ctx, chapterId)
  const startScene = sceneId || chapter.startScene
  state = withStory(state, { chapterId, sceneId: startScene, beatIndex: 0, pendingMode: null, ending: null, checkpoint: chapter.common ? state.story.checkpoint : { chapterId, sceneId: startScene } })
  events.push({ type: 'chapter', chapterId, title: chapter.title })
  state = withSceneTime(ctx, state)
  state = run(ctx, state, events)
  events.push({ type: 'autosave' })
  return { state, events }
}

/**
 * Cut away to a scene right now (collapse, Task Force raid...), whatever the
 * player was doing. A running mode is abandoned. `goto "@resume"` later
 * returns to the free-roam beat that was interrupted, or else to the start
 * of the scene (the checkpoint).
 */
export function interrupt(ctx, state, target) {
  const events = []
  // Interrupted while walking around (free roam)? Come back to that same
  // free-roam beat, so a side quest or a street event doesn't replay the
  // scene's dialogue. Anything else goes back to the scene start.
  const here = currentBeat(ctx, state)
  const inCommon = ctx.chapters[state.story.chapterId]?.common
  const returnTo =
    here?.type === 'freeRoam' && !inCommon
      ? { chapterId: state.story.chapterId, sceneId: state.story.sceneId, beatIndex: state.story.beatIndex }
      : inCommon && state.story.returnTo
        ? state.story.returnTo
        : state.story.checkpoint || { chapterId: state.story.chapterId, sceneId: state.story.sceneId }
  state = withStory(state, { pendingMode: null, returnTo })
  state = jump(ctx, state, target, events)
  state = run(ctx, state, events)
  events.push({ type: 'autosave' })
  return { state, events }
}

/** Continue past a dialogue / news / cutscene / chapter-end beat. */
export function advance(ctx, state, random) {
  const events = []
  const beat = currentBeat(ctx, state)
  if (!beat || !ADVANCEABLE.includes(beat.type)) return { state, events }

  if (beat.type === 'endChapter') {
    const completed = [...state.story.completedChapters, state.story.chapterId]
    state = withStory(state, { completedChapters: completed })
    if (beat.ending) return { state: withStory(state, { ending: beat.ending }), events: [{ type: 'autosave' }] }
    if (beat.next) return startChapter(ctx, state, beat.next)
    return { state: withStory(state, { chapterId: null, finished: true }), events: [{ type: 'autosave' }] }
  }
  state = run(ctx, nextBeat(state), events, random)
  return { state, events }
}

/** Pick option `index` of the current choice beat. */
export function choose(ctx, state, index, random) {
  const events = []
  const beat = currentBeat(ctx, state)
  if (beat?.type !== 'choice') return { state, events }
  const option = visibleOptions(state, beat).find((o) => o.index === index)
  if (!option || option.locked) return { state, events }

  const raw = beat.options[index]
  const effects = raw.effects || {}
  if (option.cost) state = apply(state, { changeStat: { money: -option.cost }, noticedBy: [] }, events)
  state = apply(state, effects, events)
  const fallback = { chapterId: state.story.chapterId, sceneId: state.story.sceneId, beatIndex: state.story.beatIndex + 1 }
  state = followFlow(ctx, state, effects, fallback, events)
  state = run(ctx, state, events, random)
  events.push({ type: 'autosave' })
  return { state, events }
}

/** A gameplay mode finished. result = { outcome, moneyChange, flags, stats, remember } */
export function receiveModeResult(ctx, state, result, random) {
  const events = []
  const pending = state.story.pendingMode
  if (!pending) return { state, events }
  state = apply(state, resultToEffects(result), events)
  const routed = pending.results?.[result.outcome] ?? pending.results?.default
  state = apply(withStory(state, { pendingMode: null }), routed, events)
  state = followFlow(ctx, state, routed, pending.resume, events)
  state = run(ctx, state, events, random)
  events.push({ type: 'autosave' })
  return { state, events }
}

/** What the UI should show right now. Pure: never changes state. */
export function renderView(ctx, state) {
  const { story } = state
  if (story.ending) {
    const ending = ctx.endings?.[story.ending] || { title: story.ending, epilogue: [] }
    // epilogue lines and the shared "fates" can be { "if": <condition>, "text": "..." }
    const lines = (list) => (list || []).filter((l) => typeof l === 'string' || checkCondition(l.if, state)).map((l) => interpolate(typeof l === 'string' ? l : l.text, state))
    return { type: 'ending', id: story.ending, title: ending.title, secret: Boolean(ending.secret), epilogue: lines(ending.epilogue), fates: lines(ctx.endings?._fates) }
  }
  if (story.finished || !story.chapterId) return { type: 'finished' }

  const chapter = chapterOf(ctx, story.chapterId)
  const scene = sceneOf(ctx, story)
  const legacy = LEGACY_BACKGROUNDS[scene.background] || {}
  const base = {
    chapterTitle: chapter.title,
    act: chapter.act,
    background: scene.background || 'default',
    chapterId: story.chapterId,
    sceneId: story.sceneId,
    location: scene.location ?? legacy.location ?? null, // where the player stands when the scene starts
    time: scene.time ?? legacy.time ?? phaseOf(state.time),
    clock: state.time ?? TIME_OF.day,
    positions: scene.positions || {}, // NPC position overrides for this scene
  }

  if (story.pendingMode) {
    const { mode, params, results } = story.pendingMode
    const key = `${story.chapterId}/${story.sceneId}/${story.beatIndex}/mode/${mode}`
    return { ...base, key, type: 'mode', mode, params, outcomes: results ? Object.keys(results).filter((k) => k !== 'default') : [] }
  }

  const beat = scene.beats[story.beatIndex]
  if (!beat || !INTERACTIVE.has(beat.type)) return { ...base, type: 'loading' }
  const key = `${story.chapterId}/${story.sceneId}/${story.beatIndex}`

  switch (beat.type) {
    case 'dialogue': {
      const line = resolveDialogue(ctx, state, beat) || { text: '' }
      return { ...base, key, type: 'dialogue', speaker: line.speaker || 'narrator', speakerName: speakerName(ctx, state, line.speaker), text: interpolate(line.text, state), mood: line.mood || null }
    }
    case 'choice':
      return {
        ...base,
        key,
        type: 'choice',
        speaker: beat.speaker || 'narrator',
        speakerName: speakerName(ctx, state, beat.speaker),
        text: interpolate(beat.text, state),
        options: visibleOptions(state, beat),
        timeout: beat.timeout || null,
        timeoutOption: beat.timeoutOption ?? null,
      }
    case 'newsBroadcast':
      return { ...base, key, type: 'news', source: beat.source || 'Radio', headline: interpolate(beat.headline, state), text: interpolate(beat.text, state) }
    case 'cutscene':
      return { ...base, key, type: 'cutscene', cards: (beat.cards || [{ title: beat.title, text: beat.text }]).map((c) => ({ title: interpolate(c.title, state), text: interpolate(c.text, state), background: c.background || null })) }
    case 'freeRoam':
      return { ...base, key, type: 'freeRoam', objective: interpolate(beat.objective || '', state), goal: beat.goal || null }
    case 'endChapter':
      return { ...base, key, type: 'chapterEnd', title: interpolate(beat.title || `End of ${chapter.title}`, state), summary: interpolate(beat.summary || '', state) }
    default:
      return { ...base, type: 'loading' }
  }
}
