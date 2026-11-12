// Campaigns: separate stories with their own hero, first chapter, world,
// visible stats and endings (data: src/game/data/campaigns.json).
import data from '../data/campaigns.json'

export const CAMPAIGNS = data.campaigns
export const DEFAULT_CAMPAIGN = 'areaBoy'

export function campaignById(id) {
  return CAMPAIGNS.find((c) => c.id === id) || CAMPAIGNS.find((c) => c.id === DEFAULT_CAMPAIGN)
}

export function campaignOf(game) {
  return campaignById(game?.campaign || DEFAULT_CAMPAIGN)
}

/** Which campaign a chapter belongs to ("campaign" in its JSON; Area Boy by default). */
export const chapterCampaign = (chapter) => chapter?.campaign || DEFAULT_CAMPAIGN

/** Endings belonging to a campaign. */
export function campaignEndings(endings, id) {
  return Object.entries(endings).filter(([k, e]) => !k.startsWith('_') && (e.campaign || DEFAULT_CAMPAIGN) === id)
}
