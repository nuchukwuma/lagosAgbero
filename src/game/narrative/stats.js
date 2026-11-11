// Every number the story can read or change lives in one flat `stats` object,
// so story JSON can say { "changeStat": { "mentorBond": 5, "money": -200 } }.

export const STAT_DEFS = {
  // money (naira). Three pockets, as the design asks.
  money: { label: 'Pocket money', group: 'money', start: 2300, min: 0, max: Infinity },
  hustleMoney: { label: 'Hustle savings', group: 'money', start: 0, min: 0, max: Infinity },
  cultMoney: { label: 'Cult funds', group: 'money', start: 0, min: 0, max: Infinity },
  debt: { label: "Mama's debt", group: 'money', start: 850000, min: 0, max: Infinity },

  // body and street
  energy: { label: 'Energy (red eyes)', group: 'street', start: 70, min: 0, max: 100 },
  notoriety: { label: 'Notoriety', group: 'street', start: 0, min: 0, max: 100 },

  // relationships (0–100)
  chairmanTrust: { label: 'Baba Ticket trusts you', group: 'relationship', start: 10, min: 0, max: 100, who: 'Baba Ticket' },
  mentorBond: { label: 'Bond with Professor', group: 'relationship', start: 10, min: 0, max: 100, who: 'Professor' },
  friendBond: { label: 'Bond with Ada', group: 'relationship', start: 0, min: 0, max: 100, who: 'Ada' },
  communityGoodwill: { label: 'Community goodwill', group: 'relationship', start: 10, min: 0, max: 100, who: 'The street' },
  policeHeat: { label: 'Task Force heat', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Task Force' },
  cultLoyalty: { label: 'Tortoise loyalty', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Tortoises' },
  rivalCultHatred: { label: 'Hyena hatred', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Hyenas' },
}

export const STAT_KEYS = Object.keys(STAT_DEFS)

export function defaultStats() {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_DEFS[k].start]))
}

export function clampStat(key, value) {
  const def = STAT_DEFS[key]
  if (!def) return value
  return Math.min(def.max, Math.max(def.min, value))
}

export function isKnownStat(key) {
  return key in STAT_DEFS
}

export function formatNaira(n) {
  return `₦${Math.round(n).toLocaleString('en-NG')}`
}
