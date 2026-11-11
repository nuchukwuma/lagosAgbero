export default function TitleScreen({ onNavigate }) {
  return (
    <div className="screen title-screen">
      <div className="title-block">
        <h1>AREA BOY</h1>
        <p className="tagline">Owo da? Na street go teach you.</p>
      </div>
      <div className="menu">
        <button className="btn btn-primary" disabled title="Arrives in Phase 1">
          New Game (Phase 1)
        </button>
        <button className="btn" onClick={() => onNavigate('assets')}>
          Asset Check (dev)
        </button>
        <button className="btn" onClick={() => onNavigate('about')}>
          About
        </button>
      </div>
      <p className="footnote">Phase 0 build</p>
    </div>
  )
}
