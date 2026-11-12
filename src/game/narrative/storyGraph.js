// A chapter as a graph, for the story map (pure, no React).
//   nodes  one per scene, plus "end" nodes (next chapter / ending)
//   edges  { from, to, kind, label, pick: [beatIndex, optionIndex] }
//     kind: choice (the player picked an option)
//           outcome (a gameplay mode finished a certain way)
//           condition (the story branched on what you did before)
//           flow (always)
// Layout puts scenes in rows by how far they are from the start.

function targetsOf(effects) {
  const out = []
  if (!effects) return out
  if (effects.goto) out.push({ to: effects.goto })
  if (effects.ending) out.push({ to: `@ending:${effects.ending}` })
  for (const [outcome, r] of Object.entries(effects.results || {})) {
    for (const t of targetsOf(r)) out.push({ ...t, outcome })
  }
  return out
}

const pretty = (id) =>
  id
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())

export function buildChapterGraph(chapter) {
  const id = chapter.id
  const nodes = new Map()
  const edges = []
  const local = (target) => {
    if (target.startsWith('@ending:')) return target
    if (target === '@resume') return '@resume'
    const [a, b] = target.split(':')
    if (!b) return a
    return a === id ? b : `@chapter:${a}`
  }
  for (const [sceneId, scene] of Object.entries(chapter.scenes || {})) {
    nodes.set(sceneId, { id: sceneId, label: scene.title || pretty(sceneId), kind: 'scene' })
    const add = (to, kind, extra = {}) => edges.push({ from: sceneId, to: local(to), kind, ...extra })
    scene.beats.forEach((beat, bi) => {
      if (beat.type === 'goto') add(beat.scene, beat.if ? 'condition' : 'flow')
      if (beat.type === 'choice') {
        beat.options.forEach((o, oi) => {
          for (const t of targetsOf(o.effects)) add(t.to, t.outcome ? 'outcome' : 'choice', { label: t.outcome || o.text, pick: [bi, oi], outcome: t.outcome })
        })
      }
      if (beat.type === 'startMode') for (const [outcome, r] of Object.entries(beat.results || {})) for (const t of targetsOf(r)) add(t.to, 'outcome', { label: outcome, outcome })
      if (beat.type === 'randomEvent') for (const o of beat.outcomes || []) for (const t of targetsOf(o.effects)) add(t.to, 'condition')
      if (beat.type === 'endChapter') add(beat.ending ? `@ending:${beat.ending}` : beat.next ? `${beat.next}:start` : '@end', 'flow')
      for (const t of targetsOf(beat.effects)) add(t.to, 'flow')
    })
    if (scene.next) add(scene.next, 'flow')
  }
  // end nodes
  for (const e of edges) {
    if (nodes.has(e.to)) continue
    const label = e.to.startsWith('@ending:') ? `Ending: ${pretty(e.to.slice(8).replace(/_/g, ' '))}` : e.to.startsWith('@chapter:') ? 'Next chapter' : e.to === '@resume' ? 'Back to the street' : 'The end'
    nodes.set(e.to, { id: e.to, label, kind: 'end' })
  }
  // de-duplicate edges with the same from/to/kind/pick
  const seen = new Set()
  const unique = edges.filter((e) => {
    const k = `${e.from}>${e.to}|${e.kind}|${e.pick || ''}|${e.outcome || ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { start: chapter.startScene, nodes: [...nodes.values()], edges: unique }
}

/** Rows by BFS depth from the start; scenes nobody points at go last. */
export function layoutGraph(graph) {
  const depth = new Map([[graph.start, 0]])
  const queue = [graph.start]
  while (queue.length) {
    const n = queue.shift()
    for (const e of graph.edges) {
      if (e.from !== n || depth.has(e.to)) continue
      depth.set(e.to, depth.get(n) + 1)
      queue.push(e.to)
    }
  }
  let maxDepth = Math.max(0, ...depth.values())
  for (const n of graph.nodes) if (!depth.has(n.id)) depth.set(n.id, ++maxDepth)
  const rows = []
  for (const n of graph.nodes) {
    const d = depth.get(n.id)
    ;(rows[d] ||= []).push(n.id)
  }
  return { depth, rows: rows.filter(Boolean) }
}

/**
 * Which parts of a chapter the player has seen.
 * history: { visited: { "ch/scene": true }, picks: [[ch, scene, beat, option]] }
 */
export function markGraph(graph, chapterId, history) {
  const visited = (sceneId) => Boolean(history.visited?.[`${chapterId}/${sceneId}`])
  const picks = (history.picks || []).filter(([c]) => c === chapterId)
  const picked = (sceneId, [bi, oi]) => picks.some(([, s, b, o]) => s === sceneId && b === bi && o === oi)
  const nodes = graph.nodes.map((n) => ({ ...n, seen: n.kind === 'scene' ? visited(n.id) : false }))
  const seenIds = new Set(nodes.filter((n) => n.seen).map((n) => n.id))
  const edges = graph.edges.map((e) => {
    const both = seenIds.has(e.from) && (seenIds.has(e.to) || !graph.nodes.find((n) => n.id === e.to && n.kind === 'scene'))
    const taken = e.kind === 'choice' ? both && picked(e.from, e.pick) : both && seenIds.has(e.to)
    return { ...e, taken }
  })
  // an end node counts as reached if an edge into it was taken
  for (const n of nodes) if (n.kind === 'end') n.seen = edges.some((e) => e.to === n.id && seenIds.has(e.from) && (e.kind !== 'choice' || e.taken))
  const scenes = nodes.filter((n) => n.kind === 'scene')
  return { nodes, edges, explored: scenes.length ? scenes.filter((n) => n.seen).length / scenes.length : 0 }
}
