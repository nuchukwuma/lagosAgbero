import Icon from '../Icon.jsx'

// End of a chapter: the summary, the choices you made, how much you explored.
export default function ChapterEndCard({ view, onNext, onMap }) {
  const recap = view.recap
  return (
    <div className="cutscene">
      <div className="cutscene-card chapter-end">
        <div className="chapter-tag">{view.chapterTitle}</div>
        <h2>{view.title}</h2>
        {view.summary && <p>{view.summary}</p>}
        {recap?.picks?.length > 0 && (
          <div className="recap">
            <h3>Your choices</h3>
            <ol>
              {recap.picks.map((p, i) => (
                <li key={i}>{p.text}</li>
              ))}
            </ol>
          </div>
        )}
        {recap && (
          <p className="muted">
            You saw {recap.seen} of {recap.total} scenes ({Math.round(recap.explored * 100)}%). Other choices lead to the rest.
          </p>
        )}
        <div className="menu">
          {onMap && (
            <button className="btn" onClick={onMap}>
              <Icon name="dodge" size={18} /> See your story map
            </button>
          )}
          <button className="btn btn-primary" onClick={onNext}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
