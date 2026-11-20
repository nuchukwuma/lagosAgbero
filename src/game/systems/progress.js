// How far into its story this run is, from 0 (the first chapter) to 1 (the
// last). Mini-games and free-roam activities get harder with it, so the
// challenge rises with the story but stays beatable (and ad power-ups can
// always take the edge off).

/** Chapters of this campaign (not the common scenes, not dev chapters). */
export function campaignChapters(chapters, campaign = 'areaBoy') {
  return Object.values(chapters).filter((c) => !c.common && (c.campaign || 'areaBoy') === campaign && c.id !== 'sandbox' && c.id !== 'dev_sandbox' && c.id !== 'test_run')
}

export function storyLevel(game, chapters) {
  if (!game?.story) return 0
  const list = campaignChapters(chapters, game.campaign || 'areaBoy')
  if (list.length < 2) return 0
  const ids = new Set(list.map((c) => c.id))
  const done = new Set((game.story.completedChapters || []).filter((id) => ids.has(id))).size
  // the chapter you're in counts as reached, even mid-way through
  const here = list.find((c) => c.id === game.story.chapterId)
  const reached = Math.max(done, here?.number ? here.number - 1 : 0)
  return Math.max(0, Math.min(1, reached / (list.length - 1)))
}
