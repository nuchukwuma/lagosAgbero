// Rewarded ads, dressed as in-world favours ("Baba Radio needs someone to
// listen to his sponsor's jingle"). Rules:
//   - only during free roam: never during dialogue, choices, fights, chases,
//     runs, cutscenes or any gameplay mode
//   - always optional, always rewarded, a few per in-game day
//   - mock by default; a real ad network plugs in behind showRewardedAd()
//     (set VITE_ADS=network and implement `networkShow` below)
import { create } from 'zustand'

export const ADS_PER_DAY = 3
export const REWARDS = {
  radioJingle: { label: 'Listen to Baba Radio\'s sponsor jingle', reward: { money: 500 }, rewardText: '+₦500' },
  garbaTea: { label: 'Help Mallam Garba test a "new" tea advert', reward: { energy: 15 }, rewardText: '+15 energy' },
  // for the stories away from Iyana-Wahala (no Baba Radio, no energy meter)
  sponsorRadio: { label: "Listen to a sponsor's jingle on a neighbour's radio", reward: { money: 500 }, rewardText: '+₦500' },
}

/** Which favour to offer: energy only where the story has an energy meter. */
export function pickPlacement(campaign, roll = Math.random()) {
  if (!campaign?.features?.energy) return 'sponsorRadio'
  return roll < 0.5 ? 'radioJingle' : 'garbaTea'
}

const SPONSORS = [
  { brand: 'Ọ̀ṣẹ̀ Dúdú Soap', line: 'Wash your face, wash your sins, wash your danfo. One soap.' },
  { brand: 'MegaPap Instant', line: 'Pap in 30 seconds. Patience not included.' },
  { brand: 'Jollof Bank', line: 'We keep your money like your mama keeps Tupperware: forever.' },
  { brand: 'NoNEPA Solar', line: 'Because NEPA said "maybe".' },
]

export const useAd = create(() => ({ playing: null }))

/** Can an ad be offered right now? */
export function canOfferAd({ view, activity, overlay, adsToday = 0 }) {
  return view?.type === 'freeRoam' && !activity && !overlay && adsToday < ADS_PER_DAY
}

/** Plays a rewarded ad. Resolves true if it was watched to the end. */
export function showRewardedAd(placement) {
  if (import.meta.env.VITE_ADS === 'network') return networkShow(placement)
  return new Promise((resolve) => {
    const sponsor = SPONSORS[Math.floor(Math.random() * SPONSORS.length)]
    useAd.setState({
      playing: {
        placement,
        sponsor,
        seconds: 5,
        done: (watched) => {
          useAd.setState({ playing: null })
          resolve(watched)
        },
      },
    })
  })
}

// A real ad SDK goes here (e.g. a web rewarded-ad unit). Keep it behind this
// function so the rest of the game never changes.
async function networkShow() {
  return false
}
