// A radio/TV news moment. Economic shocks reach the street this way.
export default function NewsBroadcast({ view, onNext }) {
  return (
    <div className="news-box" onClick={onNext} role="button" tabIndex={0}>
      <div className="news-source">📻 {view.source}</div>
      <div className="news-headline">{view.headline}</div>
      <p className="news-text">{view.text}</p>
      <div className="dialogue-next visible">▼ tap</div>
    </div>
  )
}
