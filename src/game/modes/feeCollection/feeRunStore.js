// State of one fee run, shared by the 3D director (spawns vehicles, finds the
// nearest one) and the overlay UI (COLLECT button, haggling popup, quota bar).
//
// Story params (startMode "feeCollection"):
//   spot       where vehicles stop: "backSide" (default) — see STOPS
//   duration   seconds of play (default 150)
//   vehicles   how many vehicles come (default 18)
//   drivers    named drivers to include, e.g. ["pastorDriver", "iyaKeke"]
//   defaulter  a named driver who refuses and runs: ends the run with "defaulter"
//   defaulterAt  0..1, when he arrives (default 0.7)
//   wait       seconds a vehicle waits before leaving (default 12)
//   fairFee    what drivers consider normal (default ₦500)
//   rememberAs memory key to store how the run went ("metQuota" | "half" | "poor")
//
// Drivers get tired of being asked: every vehicle you ask today (in any run)
// makes the next ones less willing: they haggle and refuse more, wait less
// before driving off, and some shove you aside and go. It resets each day
// (game.feeDay, gameStore.finishActivity). See fatigue().

import { create } from 'zustand'
import { traffic, releaseVehicle, kindInfo, LANES } from '../../systems/traffic.js'
import { feeFor, driverResponse, insist, threaten, reaction, pickLine, randomDriver, namedDriver, BASE_FAIR_FEE } from '../../systems/fees.js'
import { playerState, shake } from '../../world/worldState.js'
import { has } from '../../systems/powerups.js'

export const STOPS = {
  backSide: { x: 3, label: 'Back Side' },
  frontStop: { x: -20, label: 'Front Stop' },
}

// a bus stop: mostly danfos and molues, the rest passing through
const STOP_KINDS = [
  ['danfo', 50],
  ['molue', 10],
  ['keke', 14],
  ['okada', 8],
  ['taxi', 10],
  ['lorry', 4],
  ['boxTruck', 4],
]

// How tired of you the drivers are: 0 fresh in the morning, 1 after 50 asked.
// Tuned so a steady player (fee ₦500) makes about ₦6,500, ₦5,500, ₦4,500 in
// the day's first three runs: Baba Ticket's ₦10,000 is in reach, each run
// harder than the last (feeRunStore.test.js).
export const FATIGUE_PER = 50
export const fatigueOf = (asked) => Math.min(1.2, asked / FATIGUE_PER)
/** A driver as they are after being asked by agberos all day. */
export function weary(driver, f) {
  if (!f) return driver
  return { ...driver, tolerance: (driver.tolerance ?? 1) - 0.3 * f, stingy: Math.min(1, (driver.stingy ?? 0.5) + 0.25 * f) }
}

function pickKind(rng) {
  const total = STOP_KINDS.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [k, w] of STOP_KINDS) {
    r -= w
    if (r < 0) return k
  }
  return 'danfo'
}

export function buildSchedule(params, rng = Math.random) {
  const duration = params.duration ?? 150
  const count = params.vehicles ?? 18
  const lead = 4
  const usable = duration - 15
  const schedule = []
  for (let i = 0; i < count; i++) {
    const at = lead + (usable * i) / count + rng() * 2
    const kind = pickKind(rng)
    schedule.push({ at, kind, driver: randomDriver(kind, rng) })
  }
  // named drivers replace random slots (skip the first two so the player learns first)
  ;(params.drivers || []).forEach((id, n) => {
    const d = namedDriver(id)
    if (!d) return
    const slot = Math.min(schedule.length - 1, 2 + Math.floor(((n + 1) * (schedule.length - 3)) / ((params.drivers.length || 1) + 1)))
    schedule[slot] = { ...schedule[slot], kind: d.kind, driver: d }
  })
  if (params.defaulter) {
    const d = namedDriver(params.defaulter)
    if (d) schedule.push({ at: duration * (params.defaulterAt ?? 0.7), kind: d.kind, driver: { ...d, defaulter: true } })
  }
  return schedule.sort((a, b) => a.at - b.at)
}

const emptyEffects = () => ({ communityGoodwill: 0, notoriety: 0 })
let logId = 0

export const useFeeRun = create((set, get) => {
  const vehicleById = (id) => traffic.vehicles.find((v) => v.id === id)

  function addEffects(kind) {
    const r = reaction(kind)
    set((s) => ({
      effects: {
        communityGoodwill: s.effects.communityGoodwill + (r.communityGoodwill || 0),
        notoriety: s.effects.notoriety + (r.notoriety || 0),
      },
      counts: { ...s.counts, [kind]: (s.counts[kind] || 0) + 1 },
    }))
  }

  function log(text, amount = 0) {
    set((s) => ({ log: [...s.log.slice(-3), { id: ++logId, text, amount }], collected: s.collected + amount }))
  }

  // show a final line, then let the vehicle go
  function finishWith(v, line, { amount = 0, effect = null, boost = 1 } = {}) {
    if (effect) addEffects(effect)
    if (amount) log(`+₦${amount.toLocaleString('en-NG')} · ${v.tag.driver.name}`, amount)
    v.tag.done = true
    set({ popup: { vehicleId: v.id, name: v.tag.driver.name, line, options: [] } })
    setTimeout(() => {
      releaseVehicle(v, { speedBoost: boost })
      if (get().popup?.vehicleId === v.id) set({ popup: null })
    }, 1500)
  }

  return {
    active: false,
    started: false,
    params: {},
    stopX: STOPS.backSide.x,
    stopLabel: STOPS.backSide.label,
    duration: 150,
    timeLeft: 150,
    schedule: [],
    collected: 0,
    quota: 10000,
    stopFee: 500,
    fairFee: BASE_FAIR_FEE,
    notoriety: 0,
    near: null,
    popup: null,
    effects: emptyEffects(),
    counts: {},
    log: [],
    ended: null,
    defaulterLeft: false,
    pressure: 0, // vehicles asked earlier today
    asked: 0, // vehicles asked in this run
    shoved: 0,

    /** 0 (fresh) .. 1.2 (sick of agberos) */
    fatigue: () => fatigueOf(get().pressure + get().asked),

    start(params, stats) {
      const stop = STOPS[params.spot] || STOPS.backSide
      set({
        active: true,
        started: false,
        params,
        stopX: stop.x,
        stopLabel: stop.label,
        duration: params.duration ?? 150,
        timeLeft: params.duration ?? 150,
        schedule: buildSchedule(params),
        collected: 0,
        quota: stats.quota ?? 10000,
        stopFee: stats.stopFee ?? 500,
        // fairFeeBonus: flashy / sharp clothes make drivers accept a bit more (wardrobe.js)
        fairFee: (params.fairFee ?? stats.fairFee ?? BASE_FAIR_FEE) + (params.fairFeeBonus || 0),
        notoriety: stats.notoriety ?? 0,
        near: null,
        popup: null,
        effects: emptyEffects(),
        counts: {},
        log: [],
        ended: null,
        defaulterLeft: false,
        pressure: stats.askedToday ?? 0,
        asked: 0,
        shoved: 0,
      })
    },
    begin: () => {
      // power-ups: drivers find more fees fair (Sweet Mouth); 30 s more with a few more vehicles (Extra Time)
      const s = get()
      if (has('sweetMouth')) set({ fairFee: Math.round(s.fairFee * 1.25) })
      if (has('extraTime')) {
        const duration = s.duration + 30
        set({ duration, timeLeft: duration, schedule: buildSchedule({ ...s.params, duration, vehicles: (s.params.vehicles ?? 18) + 4 }) })
      }
      set({ started: true })
    },
    reset: () => set({ active: false, started: false, popup: null, near: null, ended: null }),
    setNear: (id) => get().near !== id && set({ near: id }),
    end: (outcome) => !get().ended && set({ ended: outcome, popup: null }),

    /** Player pressed COLLECT next to vehicle `id`. */
    collect(id) {
      const s = get()
      const v = vehicleById(id)
      if (!v || v.tag.done || s.popup || s.ended) return
      v.hold = true
      const driver = v.tag.driver
      const fee = feeFor(v.kind, s.stopFee)
      const fair = feeFor(v.kind, s.fairFee)

      if (driver.defaulter) {
        v.tag.done = true
        set({ popup: { vehicleId: v.id, name: driver.name, line: pickLine('default', {}, driver), options: [] } })
        setTimeout(() => releaseVehicle(v, { speedBoost: 1.8 }), 1400)
        setTimeout(() => get().end('defaulter'), 3200)
        return
      }

      // every car asked today makes the next driver less patient
      set({ asked: s.asked + 1 })
      const f = get().fatigue()
      v.tag.driver = weary(driver, f)
      const r = driverResponse(v.tag.driver, fee, fair)
      // a tired driver who won't pay may just push past you and go
      if (r.type === 'refuse' && f > 0.25 && Math.random() < 0.35 * f) {
        set({ shoved: s.shoved + 1 })
        playerState.stunUntil = performance.now() + 700
        shake(0.25, 0.3)
        finishWith(v, pickLine('shove', {}, driver), { effect: 'refused', boost: 1.6 })
        return
      }
      if (r.type === 'pay') {
        finishWith(v, pickLine(r.overcharged ? 'payOver' : 'pay', { fee }, driver), { amount: fee, effect: r.overcharged ? 'paidOver' : 'paidFair' })
      } else if (r.type === 'haggle') {
        set({
          popup: {
            vehicleId: v.id,
            name: driver.name,
            line: pickLine('haggle', { fee, offer: r.offer }, driver),
            options: [
              { label: `Take ₦${r.offer.toLocaleString('en-NG')}`, action: 'take', amount: r.offer },
              { label: `Insist: ₦${fee.toLocaleString('en-NG')}`, action: 'insist', amount: fee, overcharged: r.overcharged },
            ],
          },
        })
      } else {
        set({
          popup: {
            vehicleId: v.id,
            name: driver.name,
            line: pickLine('refuse', { fee }, driver),
            options: [
              { label: 'Let am go', action: 'letGo' },
              { label: 'Threaten am', action: 'threaten', amount: fee },
            ],
          },
        })
      }
    },

    /** Player picked a popup option. */
    choose(option) {
      const s = get()
      const v = s.popup && vehicleById(s.popup.vehicleId)
      if (!v) return set({ popup: null })
      const driver = v.tag.driver
      switch (option.action) {
        case 'take':
          return finishWith(v, pickLine('pay', {}, driver), { amount: option.amount, effect: 'acceptedLess' })
        case 'insist':
          return insist(driver) === 'pay'
            ? finishWith(v, pickLine('insistPay', {}, driver), { amount: option.amount, effect: option.overcharged ? 'paidOver' : 'paidFair' })
            : finishWith(v, pickLine('insistRefuse', {}, driver), { effect: 'refused' })
        case 'letGo':
          return finishWith(v, pickLine('letGo', {}, driver), { effect: 'letGo' })
        case 'threaten':
          return threaten(driver, s.notoriety) === 'pay'
            ? finishWith(v, pickLine('threatenPay', {}, driver), { amount: option.amount, effect: 'threatened' })
            : finishWith(v, pickLine('threatenRefuse', {}, driver), { effect: 'threatened', boost: 1.4 })
        default:
          return set({ popup: null })
      }
    },

    /**
     * The player is standing in front of a vehicle that's trying to leave.
     * A driver who refused (or wouldn't pay after a threat) gives in and pays;
     * one that simply got tired of waiting stops again so you can collect.
     * A defaulter still won't pay: he jumps out and legs it.
     */
    cornered(v) {
      const s = get()
      if (s.ended || v.tag.cornered) return
      const driver = v.tag.driver
      v.tag.cornered = true
      // stop right where it is
      v.state = 'stopped'
      v.stopAt = { x: v.x + LANES[v.lane].dir * (v.length / 2), wait: 10 }
      v.waited = 0
      if (driver.defaulter) {
        set({ popup: { vehicleId: v.id, name: driver.name, line: pickLine('corneredDefaulter', {}, driver), options: [] } })
        return
      }
      if (v.tag.done) {
        v.tag.done = false // finishWith marks it done again
        finishWith(v, pickLine('cornered', {}, driver), { amount: feeFor(v.kind, s.stopFee), effect: 'cornered' })
        return
      }
      v.tag.cornered = false // it may try to leave again later
      log(`Blocked · ${driver.name}: collect now`, 0)
      set({ popup: { vehicleId: v.id, name: driver.name, line: pickLine('corneredWait', {}, driver), options: [] } })
      setTimeout(() => get().popup?.vehicleId === v.id && !get().popup.options.length && set({ popup: null }), 1600)
    },

    /** A fee vehicle drove away without being dealt with. */
    missed(v) {
      if (v.tag.done) return
      v.tag.done = true
      if (v.tag.driver.defaulter) {
        set({ defaulterLeft: true })
        get().end('defaulter')
        return
      }
      addEffects('missed')
      log(`Missed · ${v.tag.driver.name}`, 0)
    },

    /** Turn the run into the result object the story receives. */
    result() {
      const s = get()
      const flags = []
      if (s.counts.threatened) flags.push('feeRun_threatened')
      if (s.counts.letGo) flags.push('feeRun_letGo')
      if (s.counts.paidOver) flags.push('feeRun_overcharged')
      if (s.defaulterLeft) flags.push('feeRun_ignoredDefaulter')
      const grade = s.collected >= s.quota ? 'metQuota' : s.collected >= s.quota * 0.5 ? 'half' : 'poor'
      if (grade === 'metQuota') flags.push('feeRun_metQuota')
      return {
        outcome: s.ended || 'done',
        moneyChange: s.collected,
        flags,
        stats: { communityGoodwill: Math.round(s.effects.communityGoodwill), notoriety: Math.round(s.effects.notoriety) },
        remember: s.params.rememberAs ? { [s.params.rememberAs]: grade } : undefined,
        summary: { collected: s.collected, quota: s.quota, counts: s.counts },
        feeAsked: s.asked, // drivers remember for the rest of the day
        ...(s.shoved ? { stats: { communityGoodwill: Math.round(s.effects.communityGoodwill), notoriety: Math.round(s.effects.notoriety), energy: -3 * s.shoved } } : {}),
      }
    },
  }
})

export function vehicleFee(v, stopFee) {
  return kindInfo(v.kind).feeFactor ? feeFor(v.kind, stopFee) : 0
}
