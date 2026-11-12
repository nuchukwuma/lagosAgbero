import { useMemo, useState } from 'react'
import { storyCtx } from '../../game/narrative/storyData.js'
import { buildChapterGraph, layoutGraph, markGraph } from '../../game/narrative/storyGraph.js'
import { campaignOf } from '../../game/narrative/campaigns.js'
import Icon from '../Icon.jsx'

// The branching story map: every scene of a chapter as a box, every choice
// as a line. Your path glows; paths you didn't take stay "???" so there is
// always a reason to play again.

const W = 150
const H = 46
const GX = 26
const GY = 62

function ChapterMap({ chapterId, story }) {
  const chapter = storyCtx.chapters[chapterId]
  const { nodes, edges, explored, pos, width, height } = useMemo(() => {
    const g = buildChapterGraph(chapter)
    const { rows } = layoutGraph(g)
    const m = markGraph(g, chapterId, story)
    const widest = Math.max(...rows.map((r) => r.length))
    const width = Math.max(1, widest) * (W + GX) + GX
    const pos = new Map()
    rows.forEach((row, ri) => {
      const rowW = row.length * (W + GX) - GX
      row.forEach((id, ci) => pos.set(id, { x: (width - rowW) / 2 + ci * (W + GX), y: 20 + ri * (H + GY) }))
    })
    return { ...m, pos, width, height: 20 + rows.length * (H + GY) }
  }, [chapter, chapterId, story])

  return (
    <div className="story-map-scroll">
      <div className="story-map-explored">
        <Icon name="star" size={16} /> {Math.round(explored * 100)}% of this chapter explored
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="story-map-svg" role="img" aria-label={`Story map of ${chapter.title}`}>
        {edges.map((e, i) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          const x1 = a.x + W / 2
          const y1 = a.y + H
          const x2 = b.x + W / 2
          const y2 = b.y
          const back = y2 <= y1
          const d = back ? `M${x1},${y1} C${x1 + 90},${y1 + 40} ${x2 + 90},${y2 - 40} ${x2},${y2}` : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
          const fromSeen = nodes.find((n) => n.id === e.from)?.seen
          const showLabel = e.kind === 'choice' && fromSeen
          return (
            <g key={i} className={`edge ${e.kind} ${e.taken ? 'taken' : ''}`}>
              <path d={d} />
              {showLabel && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle">
                  {e.label.length > 26 ? `${e.label.slice(0, 25)}…` : e.label}
                </text>
              )}
            </g>
          )
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)
          if (!p) return null
          const current = story.chapterId === chapterId && story.sceneId === n.id
          const label = n.seen ? n.label : n.kind === 'end' ? '??? ' : '???'
          return (
            <g key={n.id} className={`node ${n.kind} ${n.seen ? 'seen' : 'unseen'} ${current ? 'current' : ''}`} transform={`translate(${p.x},${p.y})`}>
              <rect width={W} height={H} rx={n.kind === 'end' ? 22 : 8} />
              <text x={W / 2} y={H / 2 + 4} textAnchor="middle">
                {label.length > 22 ? `${label.slice(0, 21)}…` : label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function StoryMap({ game, onClose }) {
  const story = game.story
  const campaign = campaignOf(game)
  // chapters of this campaign the player has started, in story order
  const chapters = useMemo(
    () =>
      Object.values(storyCtx.chapters)
        .filter((c) => !c.common && (c.campaign || 'areaBoy') === campaign.id && Object.keys(story.visited || {}).some((k) => k.startsWith(`${c.id}/`)))
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [campaign.id, story.visited],
  )
  const [tab, setTab] = useState(story.chapterId && chapters.some((c) => c.id === story.chapterId) ? story.chapterId : chapters[chapters.length - 1]?.id)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel story-map" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>
            <Icon name="dodge" size={22} /> Your story so far
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="chip-row">
          {chapters.map((c) => (
            <button key={c.id} className={`chip ${tab === c.id ? 'on' : ''}`} onClick={() => setTab(c.id)}>
              {c.number != null ? `Ch ${c.number}` : c.title}
            </button>
          ))}
        </div>
        {tab ? <ChapterMap chapterId={tab} story={story} /> : <p className="muted">Play a little first.</p>}
        <p className="footnote">Gold: the path you took. "???": scenes you missed. Every choice leads somewhere else.</p>
      </div>
    </div>
  )
}
