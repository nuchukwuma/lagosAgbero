// Checks story JSON for mistakes before you play: unknown beat types, missing
// scenes, typos in speaker names, unknown stats, bad comparisons, etc.
// Used by `npm run story:check` and by the tests.

import { parseComparison } from './conditions.js'
import { isKnownStat } from './stats.js'

const BEAT_TYPES = ['dialogue', 'choice', 'startMode', 'setFlag', 'changeStat', 'randomEvent', 'newsBroadcast', 'cutscene', 'endChapter', 'goto', 'freeRoam']
const TIMES = ['dawn', 'day', 'dusk', 'night']
const SPECIAL_SPEAKERS = ['narrator', 'player']

// True when effects always move the story elsewhere (goto / ending, or a mode
// whose every outcome does).
function leavesScene(fx) {
  if (!fx) return false
  if (fx.goto || fx.ending) return true
  if (fx.startMode && fx.results) {
    const outs = Object.values(fx.results)
    return outs.length > 0 && outs.every((r) => r?.goto || r?.ending)
  }
  return false
}

// world (optional): { spots: [...ids], npcs: [...ids] } to check locations and goals
export function validateStory({ chapters, characters = {}, callbacks = {}, endings = {}, modes = [], world = null }) {
  const errors = []
  const warnings = []
  const checkSpeaker = (s, at) => {
    if (s && !SPECIAL_SPEAKERS.includes(s) && !characters[s]) errors.push(`${at}: unknown speaker "${s}" (add it to characters.json)`)
  }

  for (const [chapterId, chapter] of Object.entries(chapters)) {
    const where = (scene, i) => `${chapterId}/${scene}${i === undefined ? '' : `#${i}`}`
    if (chapter.id !== chapterId) errors.push(`${chapterId}: "id" is "${chapter.id}", file key is "${chapterId}"`)
    if (!chapter.title) warnings.push(`${chapterId}: no title`)
    if (!chapter.scenes?.[chapter.startScene]) errors.push(`${chapterId}: startScene "${chapter.startScene}" does not exist`)

    const checkTarget = (target, at) => {
      const [a, b] = String(target).split(':')
      const [ch, sc] = b ? [a, b] : [chapterId, a]
      if (!chapters[ch]) errors.push(`${at}: goto chapter "${ch}" does not exist`)
      else if (!chapters[ch].scenes?.[sc]) errors.push(`${at}: goto scene "${sc}" does not exist in "${ch}"`)
    }
    const checkCondition = (cond, at) => {
      if (!cond || typeof cond === 'string') return
      if (Array.isArray(cond)) return cond.forEach((c) => checkCondition(c, at))
      for (const [k, v] of Object.entries(cond.stats || {})) {
        if (!isKnownStat(k)) errors.push(`${at}: unknown stat "${k}" in condition`)
        try { parseComparison(v) } catch (e) { errors.push(`${at}: ${e.message}`) }
      }
      for (const c of cond.anyOf || []) checkCondition(c, at)
    }
    const checkEffects = (fx, at) => {
      if (!fx) return
      for (const k of Object.keys(fx.changeStat || {})) if (!isKnownStat(k)) errors.push(`${at}: unknown stat "${k}"`)
      if (fx.goto) checkTarget(fx.goto, at)
      if (fx.ending && !endings[fx.ending]) errors.push(`${at}: unknown ending "${fx.ending}"`)
      if (fx.startMode && modes.length && !modes.includes(fx.startMode)) warnings.push(`${at}: mode "${fx.startMode}" is not built yet (a test stand-in will be used)`)
      for (const [outcome, r] of Object.entries(fx.results || {})) checkEffects(r, `${at} result "${outcome}"`)
    }

    for (const [sceneId, scene] of Object.entries(chapter.scenes || {})) {
      if (!Array.isArray(scene.beats)) { errors.push(`${where(sceneId)}: "beats" must be a list`); continue }
      if (scene.next) checkTarget(scene.next, where(sceneId))
      if (scene.time && !TIMES.includes(scene.time)) errors.push(`${where(sceneId)}: time must be one of ${TIMES.join(', ')}`)
      if (world && scene.location && !world.spots.includes(scene.location)) errors.push(`${where(sceneId)}: location "${scene.location}" is not a spot in the world layout`)
      for (const id of Object.keys(scene.positions || {})) if (world && !world.npcs.includes(id)) errors.push(`${where(sceneId)}: positions.${id} — no such NPC in the world layout`)
      const last = scene.beats[scene.beats.length - 1]
      if (!scene.next && !['endChapter', 'goto'].includes(last?.type) && !(last?.type === 'choice' && last.options?.every((o) => leavesScene(o.effects))) && !(last?.type === 'startMode' && leavesScene({ startMode: last.mode, results: last.results }))) {
        warnings.push(`${where(sceneId)}: last beat is "${last?.type}" and the scene has no "next" — make sure every path jumps away`)
      }

      scene.beats.forEach((beat, i) => {
        const at = where(sceneId, i)
        if (!BEAT_TYPES.includes(beat.type)) return errors.push(`${at}: unknown beat type "${beat.type}"`)
        checkCondition(beat.if, at)
        checkSpeaker(beat.speaker, at)
        checkEffects(beat.effects, at)
        for (const v of beat.variants || []) { checkSpeaker(v.speaker, at); checkCondition(v.if, at) }

        switch (beat.type) {
          case 'dialogue':
            if (!beat.text && !beat.callback) errors.push(`${at}: dialogue needs "text" or "callback"`)
            if (beat.callback && !callbacks[beat.callback]) errors.push(`${at}: callback "${beat.callback}" not in callbacks.json`)
            break
          case 'choice':
            if (!beat.options?.length) errors.push(`${at}: choice has no options`)
            beat.options?.forEach((o, j) => {
              if (!o.text) errors.push(`${at} option ${j}: no text`)
              checkCondition(o.requires, `${at} option ${j}`)
              if (typeof o.cost === 'string' && !(o.cost.startsWith('stat:') && isKnownStat(o.cost.slice(5)))) errors.push(`${at} option ${j}: cost "${o.cost}" must be a number or "stat:<name>"`)
              checkEffects(o.effects, `${at} option ${j}`)
            })
            if (beat.timeout && beat.options && !(beat.timeoutOption in beat.options)) errors.push(`${at}: timeout needs a valid "timeoutOption"`)
            break
          case 'startMode':
            if (!beat.mode) errors.push(`${at}: startMode needs "mode"`)
            checkEffects({ startMode: beat.mode, results: beat.results }, at)
            break
          case 'changeStat':
            checkEffects({ changeStat: beat.stats }, at)
            break
          case 'setFlag':
            if (!beat.flag && !beat.flags) errors.push(`${at}: setFlag needs "flag" or "flags"`)
            break
          case 'randomEvent':
            if (!beat.outcomes?.length) errors.push(`${at}: randomEvent needs "outcomes"`)
            beat.outcomes?.forEach((o, j) => { checkCondition(o.if, `${at} outcome ${j}`); checkEffects(o.effects, `${at} outcome ${j}`) })
            break
          case 'freeRoam':
            if (!beat.objective) warnings.push(`${at}: freeRoam without an objective — the player won't know what to do`)
            if (world && beat.goal?.reach && !world.spots.includes(beat.goal.reach)) errors.push(`${at}: goal spot "${beat.goal.reach}" not in the world layout`)
            if (world && beat.goal?.talkTo && !world.npcs.includes(beat.goal.talkTo)) errors.push(`${at}: goal NPC "${beat.goal.talkTo}" not in the world layout`)
            break
          case 'goto':
            if (!beat.scene) errors.push(`${at}: goto needs "scene"`)
            else checkTarget(beat.scene, at)
            break
          case 'endChapter':
            if (beat.next && !chapters[beat.next]) errors.push(`${at}: next chapter "${beat.next}" does not exist`)
            if (beat.ending && !endings[beat.ending]) errors.push(`${at}: unknown ending "${beat.ending}"`)
            break
          default:
        }
      })
    }
  }

  for (const [key, values] of Object.entries(callbacks)) {
    for (const [value, lines] of Object.entries(values)) {
      for (const line of Array.isArray(lines) ? lines : [lines]) checkSpeaker(line.speaker, `callbacks.${key}.${value}`)
    }
  }
  return { errors, warnings }
}
