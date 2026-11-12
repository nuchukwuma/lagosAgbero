// The game store (Zustand). It holds the game state, asks the story engine
// what to do, and turns engine events into toasts, autosaves and bus events.
// React components read from here and call its actions; they never touch
// the engine directly.

import { create } from 'zustand'
import { storyCtx, FIRST_CHAPTER } from '../narrative/storyData.js'
import * as engine from '../narrative/storyEngine.js'
import { bus } from '../narrative/eventBus.js'
import { saveGame, loadGame, latestSave } from './saveSystem.js'
import { defaultStats, clampStat } from '../narrative/stats.js'
import { useItem, dueEffects, drainRate, ITEMS } from '../systems/energy.js'
import { TIME_SCALE, EVENING_AT, parseTime } from '../systems/clock.js'
import { pickEvent, ROLL_EVERY } from '../systems/events.js'
import { applyEffects, resultToEffects } from '../narrative/effects.js'
import { checkCondition } from '../narrative/conditions.js'
import { useWorldStore } from '../world/worldState.js'

let toastId = 0

function summaryOf(game, view) {
  return {
    name: game.player.name,
    nickname: game.player.nickname,
    chapterTitle: view?.chapterTitle || view?.title || '',
    act: view?.act ?? null,
    money: game.stats.money,
  }
}

export const useGameStore = create((set, get) => {
  // Run an engine step safely and process what it reports.
  function dispatch(step) {
    const { game } = get()
    try {
      const { state, events } = step(game)
      const view = engine.renderView(storyCtx, state)
      const toasts = []
      for (const ev of events) {
        if (ev.type === 'toast') toasts.push({ id: ++toastId, text: ev.text })
        if (ev.type === 'autosave') saveGame('auto', state, summaryOf(state, view))
        if (ev.type === 'mode:start') bus.emit('mode:start', { mode: ev.mode, params: ev.params })
        if (ev.type === 'chapter') bus.emit('chapter:start', ev)
      }
      set((s) => ({ game: state, view, error: null, toasts: [...s.toasts, ...toasts].slice(-4) }))
    } catch (e) {
      console.error(e)
      set({ error: e.message })
    }
  }

  return {
    screen: 'title', // title | newGame | story | about | assets | load
    game: null,
    view: null,
    toasts: [],
    error: null,

    goTo: (screen) => set({ screen }),

    newGame: ({ name, nickname, look }) => {
      set({ game: engine.newGameState({ name, nickname, look }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, FIRST_CHAPTER))
    },

    // Developer: new test player dropped straight into a chapter.
    devStart: (chapterId, sceneId) => {
      set({ game: engine.newGameState({ name: 'Tester' }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, chapterId, sceneId))
    },

    // Jump straight into any chapter (used by the dev chapter picker).
    startChapter: (chapterId) => dispatch((g) => engine.startChapter(storyCtx, g, chapterId)),

    advance: () => dispatch((g) => engine.advance(storyCtx, g)),
    choose: (index) => dispatch((g) => engine.choose(storyCtx, g, index)),
    modeResult: (result) => dispatch((g) => engine.receiveModeResult(storyCtx, g, result)),

    /** Cut to a scene from anywhere (collapse, raid...). */
    interrupt: (target) => dispatch((g) => engine.interrupt(storyCtx, g, target)),

    /**
     * Called about once a second while the player is out on the street.
     * Drains energy, lands drink crashes, and collapses the player at 0.
     */
    tick: (dt, { running = false } = {}) => {
      const { game, view, activity } = get()
      if (!game || game.story.ending || game.story.chapterId === 'common') return
      const clock = (game.clock || 0) + dt
      const raining = Boolean(game.flags.raining)
      let energy = game.stats.energy - drainRate({ running, raining }) * dt
      const { remaining, crash, due } = dueEffects(game.effects, clock)
      const toasts = []
      if (crash) {
        energy -= crash
        for (const e of due) toasts.push({ id: ++toastId, text: `The ${ITEMS[e.item]?.name || 'drink'} don wear off. Your head dey bang (−${e.crash}).` })
      }
      energy = clampStat('energy', energy)
      // the clock only runs in the day loop (chapters switch it on with the flag "dayLoop")
      const dayLoop = Boolean(game.flags.dayLoop)
      const time = dayLoop ? (game.time ?? 360) + dt * TIME_SCALE : game.time
      let next = { ...game, clock, time, effects: remaining, stats: { ...game.stats, energy } }

      // random events, every ROLL_EVERY game minutes of the day loop
      let eventScene = null
      if (dayLoop && view?.type === 'freeRoam' && !activity && time >= (game.nextEventAt ?? (game.time ?? 0) + ROLL_EVERY)) {
        next.nextEventAt = time + ROLL_EVERY
        const ev = pickEvent(next)
        if (ev) {
          next.flags = { ...next.flags, [`event_${ev.id}`]: true }
          if (ev.jam) useWorldStore.getState().setJam(ev.jam)
          if (ev.effects) {
            const r = applyEffects(next, ev.effects)
            next = r.state
            for (const text of r.notices) toasts.push({ id: ++toastId, text })
          }
          if (ev.scene) eventScene = ev.scene
        }
      }
      set((s) => ({ game: next, toasts: [...s.toasts, ...toasts].slice(-4) }))

      if (energy <= 0) return get().interrupt('common:collapse')
      if (activity) return undefined
      if (dayLoop && time >= EVENING_AT && view?.type === 'freeRoam') return get().interrupt('daily:evening')
      if (eventScene) return get().interrupt(eventScene)
      // freeRoam goals that wait for a time or a condition
      const goal = view?.type === 'freeRoam' ? view.goal : null
      if (goal?.until && checkCondition(goal.until, next)) return get().advance()
      if (goal?.atTime && time >= parseTime(goal.atTime)) return get().advance()
      return undefined
    },

    /** Free-roam activities the player starts (e.g. a fee run at the Back Side). */
    activity: null,
    startActivity: (activity) => set({ activity }),
    finishActivity: (result) => {
      const { game, activity } = get()
      if (!game || !activity) return set({ activity: null })
      const r = applyEffects(game, resultToEffects(result))
      const minutes = activity.minutes ?? 120
      const next = { ...r.state, time: Math.min((r.state.time ?? 0) + minutes, EVENING_AT - 1) }
      const summary = result.moneyChange ? `+₦${result.moneyChange.toLocaleString('en-NG')}` : 'No money this time'
      set((s) => ({ game: next, activity: null, toasts: [...s.toasts, { id: ++toastId, text: `${activity.label || 'Done'}: ${summary}` }, ...r.notices.map((t) => ({ id: ++toastId, text: t }))].slice(-4) }))
      saveGame('auto', next, summaryOf(next, get().view))
    },

    /** Buy and use an item from a vendor. Returns an error message or null. */
    buy: (itemId) => {
      const { game } = get()
      const r = useItem(itemId, game, game.clock || 0)
      if (r.error) return r.error
      const stats = { ...game.stats }
      for (const [k, d] of Object.entries(r.stats)) stats[k] = clampStat(k, (stats[k] ?? 0) + d)
      const flags = { ...game.flags, [`used_${itemId}`]: true }
      if (ITEMS[itemId].kind === 'drink' && ITEMS[itemId].habit) flags.hadStrongDrink = true
      const next = { ...game, stats, flags, effects: [...(game.effects || []), ...r.effects] }
      set((s) => ({ game: next, toasts: [...s.toasts, { id: ++toastId, text: r.message }].slice(-4) }))
      saveGame('auto', next, summaryOf(next, get().view))
      return null
    },

    save: (slot) => {
      const { game, view } = get()
      if (!game) return false
      const ok = saveGame(slot, game, summaryOf(game, view))
      set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text: ok ? `Saved to slot ${slot}.` : 'Could not save on this device.' }] }))
      return ok
    },

    load: (slot) => {
      const saved = loadGame(slot)
      if (!saved) return false
      // Saves from older versions may lack stats added later: fill defaults.
      const game = { ...saved, stats: { ...defaultStats(), ...saved.stats }, flags: saved.flags || {}, memory: saved.memory || {} }
      try {
        set({ game, view: engine.renderView(storyCtx, game), screen: 'story', toasts: [], error: null })
        return true
      } catch (e) {
        set({ error: `This save no longer matches the story: ${e.message}` })
        return false
      }
    },

    continueGame: () => {
      const latest = latestSave()
      return latest ? get().load(latest.slot) : false
    },

    quitToTitle: () => set({ screen: 'title', toasts: [] }),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }
})

// Gameplay modes report back through the event bus.
bus.on('mode:result', (result) => useGameStore.getState().modeResult(result))
