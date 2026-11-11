// Shown when the story reaches an ending. Only endings finish the game.
export default function EndingScreen({ view, onTitle, onLoad }) {
  return (
    <div className="ending-screen">
      <div className="ending-label">ENDING</div>
      <h1>{view.title}</h1>
      <div className="ending-epilogue">
        {view.epilogue.map((line, i) => (
          <p key={i} style={{ animationDelay: `${i * 0.9}s` }}>
            {line}
          </p>
        ))}
      </div>
      <div className="menu">
        <button className="btn" onClick={onLoad}>
          Load a save
        </button>
        <button className="btn btn-primary" onClick={onTitle}>
          Back to title
        </button>
      </div>
    </div>
  )
}
