// Every number the story can read or change lives in one flat `stats` object,
// so story JSON can say { "changeStat": { "mentorBond": 5, "money": -200 } }.

export const STAT_DEFS = {
  // money (naira). Three pockets, as the design asks.
  money: { label: 'Pocket money', group: 'money', start: 2300, min: 0, max: Infinity },
  hustleMoney: { label: 'Hustle savings', group: 'money', start: 0, min: 0, max: Infinity },
  cultMoney: { label: 'Cult funds', group: 'money', start: 0, min: 0, max: Infinity },
  debt: { label: "Mama's debt", group: 'money', start: 850000, min: 0, max: Infinity },
  quota: { label: "Baba Ticket's daily share", group: 'money', start: 15000, min: 0, max: Infinity },
  stopFee: { label: 'Your stop fee (per danfo)', group: 'money', start: 500, min: 100, max: 2000 },

  // body and street
  energy: { label: 'Energy (red eyes)', group: 'street', start: 70, min: 0, max: 100 },
  notoriety: { label: 'Notoriety', group: 'street', start: 0, min: 0, max: 100 },
  habit: { label: 'Drinking habit', group: 'hidden', start: 0, min: 0, max: 100 },
  collapses: { label: 'Times collapsed', group: 'hidden', start: 0, min: 0, max: 99 },
  fairFee: { label: 'What drivers call fair', group: 'hidden', start: 500, min: 100, max: 5000 },
  day: { label: 'Day', group: 'hidden', start: 1, min: 1, max: 999 },
  arrests: { label: 'Times arrested', group: 'hidden', start: 0, min: 0, max: 99 },
  cultRank: { label: 'Tortoise rank', group: 'hidden', start: 0, min: 0, max: 5 },
  bribesPaid: { label: 'Bribes paid to Bassey', group: 'hidden', start: 0, min: 0, max: 99 },

  // relationships (0–100)
  chairmanTrust: { label: 'Baba Ticket trusts you', group: 'relationship', start: 10, min: 0, max: 100, who: 'Baba Ticket' },
  mentorBond: { label: 'Bond with Professor', group: 'relationship', start: 10, min: 0, max: 100, who: 'Professor' },
  friendBond: { label: 'Bond with Ada', group: 'relationship', start: 0, min: 0, max: 100, who: 'Ada' },
  communityGoodwill: { label: 'Community goodwill', group: 'relationship', start: 10, min: 0, max: 100, who: 'The street' },
  policeHeat: { label: 'Task Force heat', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Task Force' },
  settlementTrust: { label: 'Settlement trusts you', group: 'relationship', start: 0, min: 0, max: 100, who: 'Barrister Settlement' },
  cultLoyalty: { label: 'Tortoise loyalty', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Tortoises' },
  rivalCultHatred: { label: 'Hyena hatred', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Hyenas' },

  // ---- Grass to Grace (Emeka) ----
  conscience: { label: 'Conscience', group: 'street', start: 60, min: 0, max: 100 },
  villageDebt: { label: 'What you owe Nkwọ-Agụụ', group: 'money', start: 0, min: 0, max: Infinity },
  hold: { label: "The Fellowship's hold on you", group: 'street', start: 0, min: 0, max: 100 },
  motherBond: { label: 'Bond with Nne', group: 'relationship', start: 60, min: 0, max: 100, who: 'Nne' },
  chinweBond: { label: 'Bond with Chinwe', group: 'relationship', start: 55, min: 0, max: 100, who: 'Chinwe' },
  ikeTrust: { label: 'Ike trusts you', group: 'relationship', start: 40, min: 0, max: 100, who: 'Ike' },
  chiefFavour: { label: "Chief Ọ̀dụ̀'s favour", group: 'relationship', start: 0, min: 0, max: 100, who: 'Chief Ọ̀dụ̀' },
  villageStanding: { label: 'Standing in Nkwọ-Agụụ', group: 'relationship', start: 40, min: 0, max: 100, who: 'Nkwọ-Agụụ' },

  // ---- Campus (Somto) ----
  schoolFees: { label: 'Fees owed', group: 'money', start: 0, min: 0, max: Infinity },
  loanDebt: { label: 'QuickCash loan', group: 'money', start: 0, min: 0, max: Infinity },
  cgpa: { label: 'CGPA', group: 'street', start: 3.5, min: 0, max: 5, decimals: 2 },
  cover: { label: 'Your cover story', group: 'street', start: 70, min: 0, max: 100 },
  tamaraBond: { label: 'Bond with Tamara', group: 'relationship', start: 0, min: 0, max: 100, who: 'Tamara' },
  momBond: { label: 'Bond with Mama', group: 'relationship', start: 70, min: 0, max: 100, who: 'Mama' },
  dubaiBond: { label: 'Bond with Dubai', group: 'relationship', start: 20, min: 0, max: 100, who: 'Dubai' },
  campusRep: { label: 'Campus reputation', group: 'relationship', start: 10, min: 0, max: 100, who: 'The campus' },
  donsHeat: { label: 'Crimson Dons interest', group: 'relationship', start: 0, min: 0, max: 100, who: 'The Crimson Dons' },
}

// Tortoise ranks, indexed by the cultRank stat.
export const RANK_NAMES = ['Outsider', 'Egg', 'Hatchling', 'Shell', 'Hard Shell', 'Number Two Shell']

export const STAT_KEYS = Object.keys(STAT_DEFS)

export function defaultStats(overrides = {}) {
  return { ...Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_DEFS[k].start])), ...overrides }
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
