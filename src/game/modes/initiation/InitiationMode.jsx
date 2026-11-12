import { useEffect, useMemo, useState } from "react";
import {
  createInitiation,
  answer,
  currentQuestion,
  initiationResult,
  CULT,
  MAX_WRONG,
} from "./initiationLogic.js";

// Tortoise initiation: coded questions in a candle-lit room. Story params:
//   questions  ids from cult.json (default: 5 random)
//   seconds    time per question (default 12)
// Outcomes: perfect | passed | attacked

export default function InitiationMode({ params, onFinish }) {
  const s = useMemo(
    () =>
      createInitiation({
        ids: params.questions || null,
        seed: params.seed ?? Math.floor(Math.random() * 999),
      }),
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const seconds = params.seconds ?? 12;
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(seconds);
  const [note, setNote] = useState(null);
  const [, force] = useState(0);
  const q = currentQuestion(s);

  const pick = (choice) => {
    const ok = answer(s, choice);
    setNote(
      ok
        ? "Silence. Then a single knock on the table. Correct."
        : CULT.warnings[(s.wrong - 1) % CULT.warnings.length],
    );
    setLeft(seconds);
    force((n) => n + 1);
  };

  useEffect(() => {
    if (!started || s.over) return undefined;
    const id = setInterval(() => setLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [started, s.over]);
  useEffect(() => {
    if (started && !s.over && left <= 0) pick(null);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = <div className="candle-room" aria-hidden="true" />;

  if (!started)
    return (
      <>
        {room}
        <div className="fee-intro initiation">
          <h2>The Shell House</h2>
          <p>
            A dark room. One candle. Men in brown and yellow sit around a table
            piled with files. A voice says: "Answer as a Tortoise answers."
          </p>
          <ul>
            <li>Coded questions. {seconds} seconds each.</li>
            <li>
              {MAX_WRONG} wrong answers, and the brothers will "correct" you.
            </li>
            <li>Remember what Chuks taught you.</li>
          </ul>
          <button className="btn btn-primary" onClick={() => setStarted(true)}>
            Sit down
          </button>
        </div>
      </>
    );

  if (s.over) {
    const titles = {
      perfect: "Two knocks. Applause. Slow applause.",
      passed: '"Acceptable. File him."',
      attacked: "The candle goes out.",
    };
    return (
      <>
        {room}
        <div className="fee-intro initiation">
          <h2>{titles[s.over]}</h2>
          <p>
            {s.right} right · {s.wrong} wrong
          </p>
          <button
            className="btn btn-primary"
            onClick={() => onFinish(initiationResult(s))}
          >
            Continue
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {room}
      <div className="fee-popup initiation">
        <div className="fee-row">
          <span className="speaker-name">
            Question {s.index + 1}/{s.questions.length}
          </span>
          <span className={left <= 4 ? "warn" : "muted"}>{left}s</span>
        </div>
        {note && <p className="muted">{note}</p>}
        <p>
          <strong>"{q.q}"</strong>
        </p>
        <div className="fee-options column">
          {q.answers.map((a, i) => (
            <button key={i} className="btn" onClick={() => pick(i)}>
              {a}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
