import { endingsFound, chaptersDone } from '../game/store/saveSystem.js'
import { storyCtx } from '../game/narrative/storyData.js'
import { CAMPAIGNS, campaignEndings, chapterCampaign } from '../game/narrative/campaigns.js'
import Icon from './Icon.jsx'

// Your progress in each story: the chapters you've finished (on this
// device, in any save), and every ending, found or with a hint for the ones
// you haven't. A reason to go back and choose differently.
export default function EndingsScreen({ onBack }) {
  const found = new Set(endingsFound())
  const done = new Set(chaptersDone())
  return (
    <div className="screen endings-screen">
      <h2>Progress</h2>
      <p className="muted">How far you've got in each story. Every story ends differently depending on what you chose; hints point the way to the endings you haven't seen.</p>
      {CAMPAIGNS.map((c) => {
        const endings = campaignEndings(storyCtx.endings, c.id)
        const got = endings.filter(([id]) => found.has(id)).length
        const chapters = Object.values(storyCtx.chapters)
          .filter((ch) => !ch.common && !/^(dev_|test_)/.test(ch.id) && chapterCampaign(ch) === c.id) // not the developer test chapters
          .sort((a, b) => (a.act || 0) - (b.act || 0) || (a.number || 0) - (b.number || 0))
        const finished = chapters.filter((ch) => done.has(ch.id)).length
        return (
          <section key={c.id} className="endings-group">
            <h3>{c.title}</h3>
            <div className="progress-line">
              <span>Chapters</span>
              <small>
                {finished} of {chapters.length}
              </small>
            </div>
            <div className="endings-bar" role="img" aria-label={`${finished} of ${chapters.length} chapters finished`}>
              <div style={{ width: `${chapters.length ? (finished / chapters.length) * 100 : 0}%` }} />
            </div>
            <ol className="chapter-list">
              {chapters.map((ch) => (
                <li key={ch.id} className={done.has(ch.id) ? 'done' : ''}>
                  {done.has(ch.id) ? '✓ ' : ''}
                  {ch.title}
                </li>
              ))}
            </ol>
            <div className="progress-line">
              <span>Endings</span>
              <small>
                {got} of {endings.length}
              </small>
            </div>
            <div className="endings-bar" role="img" aria-label={`${got} of ${endings.length} endings found`}>
              <div style={{ width: `${(got / endings.length) * 100}%` }} />
            </div>
            <ul>
              {endings.map(([id, e]) =>
                found.has(id) ? (
                  <li key={id} className="ending-item found">
                    <Icon name="star" size={18} />
                    <div>
                      <strong>{e.title}</strong>
                      {e.secret && <em> · secret</em>}
                    </div>
                  </li>
                ) : (
                  <li key={id} className="ending-item">
                    <span className="ending-lock" aria-hidden="true">
                      ?
                    </span>
                    <div>
                      <strong>{e.secret ? 'Secret ending' : '???'}</strong>
                      {e.hint && <span>{e.hint}</span>}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        )
      })}
      <button className="btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
