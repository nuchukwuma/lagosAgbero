import { endingsFound } from '../game/store/saveSystem.js'
import { storyCtx } from '../game/narrative/storyData.js'
import { CAMPAIGNS, campaignEndings } from '../game/narrative/campaigns.js'
import Icon from './Icon.jsx'

// Every ending of every story: the ones you've reached, and a hint for the
// ones you haven't. A reason to go back and choose differently.
export default function EndingsScreen({ onBack }) {
  const found = new Set(endingsFound())
  return (
    <div className="screen endings-screen">
      <h2>Endings</h2>
      <p className="muted">Each story ends differently depending on what you chose. Hints point the way to the ones you haven't seen.</p>
      {CAMPAIGNS.map((c) => {
        const endings = campaignEndings(storyCtx.endings, c.id)
        const got = endings.filter(([id]) => found.has(id)).length
        return (
          <section key={c.id} className="endings-group">
            <h3>
              {c.title}{' '}
              <small>
                {got} of {endings.length}
              </small>
            </h3>
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
