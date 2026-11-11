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

import { create } from 'zustand'
import { traffic, releaseVehicle, kindInfo } from '../../systems/traffic.js'
import { feeFor, driverResponse, insist, threaten, reaction, pickLine, randomDriver, namedDriver, BASE_FAIR_FEE } from '../../systems/fees.js'

export const STOPS = {
  backSide: { x: 3, label: 'Back Side' },
  frontStop: { x: -20, label: 'Front Stop' },
}

const STOP_KINDS = [
  ['danfo', 44],
  ['keke', 18],
  ['okada', 14],
  ['taxi', 12],
  ['lorry', 6],
  ['boxTruck', 6],
]

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
    quota: 15000,
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
        quota: stats.quota ?? 15000,
        stopFee: stats.stopFee ?? 500,
        fairFee: params.fairFee ?? BASE_FAIR_FEE,
        notoriety: stats.notoriety ?? 0,
        near: null,
        popup: null,
        effects: emptyEffects(),
        counts: {},
        log: [],
        ended: null,
        defaulterLeft: false,
      })
    },
    begin: () => set({ started: true }),
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

      const r = driverResponse(driver, fee, fair)
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
      }
    },
  }
})

export function vehicleFee(v, stopFee) {
  return kindInfo(v.kind).feeFactor ? feeFor(v.kind, stopFee) : 0
}
