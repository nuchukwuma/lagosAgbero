// The game store (Zustand). It holds the game state, asks the story engine
// what to do, and turns engine events into toasts, autosaves and bus events.
// React components read from here and call its actions; they never touch
// the engine directly.

import { create } from 'zustand'
import { storyCtx, FIRST_CHAPTER } from '../narrative/storyData.js'
import { storyLevel } from '../systems/progress.js'
import * as engine from '../narrative/storyEngine.js'
import { bus } from '../narrative/eventBus.js'
import { saveGame, loadGame, latestSave, recordChapters } from './saveSystem.js'
import { defaultStats, clampStat } from '../narrative/stats.js'
import { consumeItem, dueEffects, drainRate, ITEMS } from '../systems/energy.js'
import { TIME_SCALE, EVENING_AT, parseTime } from '../systems/clock.js'
import { pickEvent, ROLL_EVERY } from '../systems/events.js'
import { applyEffects, resultToEffects } from '../narrative/effects.js'
import { checkCondition } from '../narrative/conditions.js'
import { useWorldStore, playerState } from '../world/worldState.js'
import { styleOf, styleFlags, costOf, ownedAfter } from '../systems/wardrobe.js'
import { campaignById, campaignOf, chapterCampaign } from '../narrative/campaigns.js'
import { collectFind } from '../systems/finds.js'
import { effectsFor } from '../systems/reactions.js'
import { useStreet } from '../world/streetState.js'
import { tunedActivity, recordRun } from '../systems/heat.js'
import { clearPowerups } from '../systems/powerups.js'
import { useSettings } from './settings.js'

let toastId = 0

function summaryOf(game, view) {
  return {
    campaign: campaignOf(game).title,
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
      if (state?.story?.completedChapters?.length !== game?.story?.completedChapters?.length) recordChapters(state.story.completedChapters)
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

    /** Start a campaign (campaigns.json): Area Boy, Grass to Grace, the campus story... */
    newGame: ({ name, nickname, look, campaign = 'areaBoy' }) => {
      const c = campaignById(campaign)
      set({ game: engine.newGameState({ name, nickname, look, campaign: c.id, stats: c.startStats || {} }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, c.firstChapter || FIRST_CHAPTER))
    },

    // Developer: new test player dropped straight into a chapter.
    devStart: (chapterId, sceneId) => {
      const c = campaignById(chapterCampaign(storyCtx.chapters[chapterId]))
      set({ game: engine.newGameState({ name: c.hero?.name || 'Tester', nickname: c.hero?.nickname, look: c.hero?.look || null, campaign: c.id, stats: c.startStats || {} }), screen: 'story', toasts: [] })
      dispatch((g) => engine.startChapter(storyCtx, g, chapterId, sceneId))
    },

    // Developer: play one game on its own (the All games screen). It runs in
    // the sandbox street and comes back to that screen when it's done.
    playGame: ({ mode, label, params = {} }) => {
      get().devStart('dev_sandbox')
      set({ activity: { id: `games-${mode}`, label: label || mode.toUpperCase(), mode, params, minutes: 0, fromGames: true, key: `games-${mode}-${Date.now()}` } })
    },

    // Jump straight into any chapter (used by the dev chapter picker).
    startChapter: (chapterId) => dispatch((g) => engine.startChapter(storyCtx, g, chapterId)),

    advance: () => {
      dispatch((g) => engine.advance(storyCtx, g))
      // "Change my answer" lasts a few lines after the choice, not for the whole chapter
      const lc = get().lastChoice
      if (lc) {
        const steps = (lc.steps || 0) + 1
        const t = get().view?.type
        set({ lastChoice: steps > 3 || !['dialogue', 'news'].includes(t) ? null : { ...lc, steps } })
      }
    },
    choose: (index) => {
      // keep the moment before the pick, so "Change my answer" can undo it
      const { game, view } = get()
      dispatch((g) => engine.choose(storyCtx, g, index))
      const after = get().view
      set({ lastChoice: after?.type === 'dialogue' || after?.type === 'news' || after?.type === 'choice' ? { game, view } : null })
    },
    lastChoice: null,
    /** Go back to the choice you just made and pick again (until the next choice, activity or chapter). */
    undoChoice: () => {
      const back = get().lastChoice
      if (!back) return
      set({ game: back.game, view: engine.renderView(storyCtx, back.game), lastChoice: null })
    },
    /** A choice you can't afford yet: go and raise the money in free roam. */
    raiseMoney: (index) => dispatch((g) => engine.raiseMoney(storyCtx, g, index)),
    /** At a chapter's end: free roam before the next chapter. */
    roamFirst: () => dispatch((g) => engine.roamFirst(storyCtx, g)),
    modeResult: (result) => {
      clearPowerups() // used up
      dispatch((g) => engine.receiveModeResult(storyCtx, g, result))
    },

    /** Cut to a scene from anywhere (collapse, raid...). */
    interrupt: (target) => dispatch((g) => engine.interrupt(storyCtx, g, target)),
    /** Start a side quest (quests.json) from free roam. */
    startQuest: (quest) => {
      if (get().view?.type !== 'freeRoam' || get().activity) return
      dispatch((g) => engine.interrupt(storyCtx, g, quest.start))
    },

    /**
     * Called about once a second while the player is out on the street.
     * Drains energy, lands drink crashes, and collapses the player at 0.
     */
    tick: (dt, { running = false } = {}) => {
      const { game, view, activity } = get()
      // no clock, drain or events inside interruptions (collapse, raids, evenings...)
      if (!game || game.story.ending || storyCtx.chapters[game.story.chapterId]?.common) return
      const clock = (game.clock || 0) + dt
      const raining = Boolean(game.flags.raining)
      // only Area Boy has the energy (red eyes) system
      const energyOn = campaignOf(game).features?.energy !== false
      let energy = energyOn ? game.stats.energy - drainRate({ running, raining }) * dt : game.stats.energy
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

      if (energyOn && energy <= 0) return get().interrupt('common:collapse')
      if (activity) return undefined
      if (dayLoop && time >= EVENING_AT && view?.type === 'freeRoam') return get().interrupt('daily:evening')
      if (eventScene) return get().interrupt(eventScene)
      // freeRoam goals that wait for a time or a condition
      const goal = view?.type === 'freeRoam' ? view.goal : null
      if (goal?.until && checkCondition(goal.until, next)) return get().advance()
      if (goal?.atTime && time >= parseTime(goal.atTime)) return get().advance()
      return undefined
    },

    /**
     * The street reacts to something the player did (reactions.json "effects":
     * "apologise", "argueWon", "bumpedTooMuch"...). `count` bumps the
     * street's memory of you (e.g. { roadRage: 1 }): drivers who've heard of
     * you lose patience sooner.
     */
    react: (action, { toast = null, count = null } = {}) => {
      const { game } = get()
      if (!game) return
      const changeStat = effectsFor(action, campaignOf(game).id)
      const r = applyEffects(game, { changeStat, noticedBy: [] })
      const street = { ...(game.street || {}) }
      for (const [k, n] of Object.entries(count || {})) street[k] = (street[k] || 0) + n
      const next = { ...r.state, street }
      const notes = [toast, ...r.notices].filter(Boolean)
      set((s) => ({ game: next, toasts: [...s.toasts, ...notes.map((text) => ({ id: ++toastId, text }))].slice(-4) }))
    },

    /** Free-roam activities the player starts (e.g. a fee run at the Back Side). */
    activity: null,
    startActivity: (activity) => {
      // repeat runs get hot (systems/heat.js): harder, or staked out for a while
      const { game } = get()
      const tuned = game ? tunedActivity(game, activity, storyLevel(game, storyCtx.chapters)) : activity
      if (tuned.blocked) return set((s) => ({ toasts: [...s.toasts, { id: ++toastId, text: tuned.blocked }].slice(-4) }))
      set({ activity: tuned })
    },
    /** Your fee per danfo (others pay a share), chosen before a fee run. */
    setStopFee: (fee) => {
      const { game } = get()
      if (game) set({ game: { ...game, stats: { ...game.stats, stopFee: clampStat('stopFee', Math.round(fee / 50) * 50) } } })
    },
    finishActivity: (result) => {
      clearPowerups() // used up
      const { game, activity } = get()
      if (!game || !activity) return set({ activity: null })
      let r = applyEffects(game, resultToEffects(result))
      // world JSON activities may add their own rewards per outcome:
      //   "results": { "won": { "changeStat": { "cultMoney": 3000 } } }
      const extra = activity.results?.[result.outcome] || activity.results?.default
      if (extra) {
        const r2 = applyEffects(r.state, extra)
        r = { state: r2.state, notices: [...r.notices, ...r2.notices] }
      }
      const minutes = activity.minutes ?? 120
      const next = { ...r.state, time: Math.min((r.state.time ?? 0) + minutes, EVENING_AT - 1) }
      if (activity.mode === 'runner' && activity.params?.endless) Object.assign(next, { heat: recordRun(next, activity.id).heat })
      // drivers remember how many times agberos asked them today (fee runs get harder; a new day resets it)
      if (result.feeAsked) {
        const day = next.stats.day
        next.feeDay = { day, asked: (next.feeDay?.day === day ? next.feeDay.asked : 0) + result.feeAsked }
      }
      if (activity.mode === 'fight') useStreet.setState({ lastFight: { outcome: result.outcome, at: performance.now() } })
      const m = result.moneyChange || 0
      const summary = m > 0 ? `+₦${m.toLocaleString('en-NG')}` : m < 0 ? `−₦${(-m).toLocaleString('en-NG')}` : 'No money this time'
      // one event can lead straight into another: a crash into a fight, a
      // wrecked bus into a foot chase ("then": { "mode", "params", "label" })
      const then = extra?.then
      const chained = then ? { id: `${activity.id}-then`, label: then.label || 'WAHALA', mode: then.mode, params: then.params || {}, minutes: then.minutes ?? 20, results: then.results, key: `${activity.id}-then-${Date.now()}` } : null
      if (activity.fromGames) return set({ game: next, activity: null, screen: 'games', toasts: [] })
      set((s) => ({ game: next, activity: chained, toasts: [...s.toasts, { id: ++toastId, text: `${activity.label || 'Done'}: ${summary}` }, ...r.notices.map((t) => ({ id: ++toastId, text: t }))].slice(-4) }))
      saveGame('auto', next, summaryOf(next, get().view))
    },

    /** Buy and use an item from a vendor. Returns an error message or null. */
    buy: (itemId) => {
      const { game } = get()
      const r = consumeItem(itemId, game, game.clock || 0)
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

    /** Free roam: the player walked over a street find (a note, a sachet of water...). */
    pickUpFind: (find, layoutId) => {
      const { game } = get()
      const r = game && collectFind(find, layoutId, game)
      if (!r) return false
      const next = { ...applyEffects(game, r.effects).state, finds: r.finds }
      set((s) => ({ game: next, toasts: [...s.toasts, { id: ++toastId, text: r.text }].slice(-4) }))
      return true
    },

    /** Wardrobe: pay for new things, change the look, nickname and style flags. */
    dress: ({ look, nickname }) => {
      const { game } = get()
      if (!game) return 'No game'
      const owned = game.owned || []
      const cost = costOf(game.player.look || {}, look, owned)
      if ((game.stats.money ?? 0) < cost) return `You need ₦${cost.toLocaleString('en-NG')}`
      const style = styleOf(look)
      const next = {
        ...game,
        // bought new clothes: no longer the dusty JJC
        player: { ...game.player, look: cost > 0 ? { ...look, rugged: false } : look, nickname: nickname || game.player.nickname },
        owned: ownedAfter(look, owned),
        stats: { ...game.stats, money: game.stats.money - cost },
        flags: { ...game.flags, ...styleFlags(style) },
      }
      set((s) => ({ game: next, toasts: [...s.toasts, { id: ++toastId, text: cost ? `New look: -₦${cost.toLocaleString('en-NG')}` : 'Looking sharp.' }].slice(-4) }))
      saveGame('auto', next, summaryOf(next, get().view))
      return null
    },

    /** Rewarded favour (mock ad) finished: give the reward, count it for today. */
    grantFavour: (reward) => {
      const { game } = get()
      if (!game) return
      const day = game.stats.day
      const ads = game.ads?.day === day ? game.ads : { day, count: 0 }
      const stats = { ...game.stats }
      for (const [k, d] of Object.entries(reward)) stats[k] = clampStat(k, (stats[k] ?? 0) + d)
      const next = { ...game, stats, ads: { day, count: ads.count + 1 } }
      set((s) => ({ game: next, toasts: [...s.toasts, { id: ++toastId, text: 'Favour done. The street remembers small kindness.' }].slice(-4) }))
      saveGame('auto', next, summaryOf(next, get().view))
    },

    /** Quiet autosave (tab hidden, app backgrounded). */
    autosave: () => {
      const { game, view } = get()
      if (game) saveGame('auto', game, summaryOf(game, view))
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
      recordChapters(game.story?.completedChapters) // saves from before Progress was kept count too
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

// dev builds, or any build opened with ?bench: scripted play-throughs and memory checks
if (typeof window !== 'undefined' && (import.meta.env.DEV || new URLSearchParams(window.location.search).has('bench'))) {
  window.__gameStore = useGameStore
  window.__playerState = playerState
  window.__settings = useSettings
}
