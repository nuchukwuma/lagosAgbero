export default function ChapterEndCard({ view, onNext }) {
  return (
    <div className="cutscene">
      <div className="cutscene-card">
        <div className="chapter-tag">{view.chapterTitle}</div>
        <h2>{view.title}</h2>
        {view.summary && <p>{view.summary}</p>}
        <button className="btn btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  )
}
