export default function AboutScreen({ onBack }) {
  return (
    <div className="screen about-screen">
      <h2>About</h2>
      <div className="about-card">
        <h3>This is satire</h3>
        <p>
          Area Boy is a comedy about hustling in Lagos. Every person, politician, party, cult, brand, agency and
          drink in this game is made up. Any resemblance to real people or organisations is a coincidence, or
          Lagos being Lagos.
        </p>
        <p>
          The game does not celebrate extortion, violence or cultism. It laughs at the system that makes them
          feel like the only way, and it lets you choose another way.
        </p>
        <h3>Credits</h3>
        <p>City, vehicles and props: Kenney (kenney.nl), CC0.</p>
        <p>People and the bus: Quaternius (quaternius.com), CC0.</p>
        <p>Animations: Mixamo (Adobe).</p>
      </div>
      <button className="btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
