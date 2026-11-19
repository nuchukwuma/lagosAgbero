import { useEffect, useRef, useState } from "react";
import { useFight, fightInput } from "./fightStore.js";
import { useDevice } from "../../../components/hud/useDevice.js";
import PixelIcon from "../../../components/PixelIcon.jsx";
import Fight2D from "./Fight2D.jsx";
import PowerupOffer from "../../../components/hud/PowerupOffer.jsx";
import { drawPixelPortrait } from "./fight2d/pixel.js";
import { COIN } from "./fightLogic.js";
import Joystick from "../../../components/hud/Joystick.jsx";
import { showRewardedAd } from "../../services/adService.js";
import { seenIntro, markIntroSeen, fightRecord, recordFight } from "../../systems/records.js";

// Fight overlay: round portrait badges with health bars, the special meter,
// the crowd's money (the purse), round see-through buttons with pixel-art
// icons (touch) or keys. Bars are square-ended, like the pixel art.
// Touch: a stick (left/right move, up jump, down squat) and buttons.
// Keys: A/D or ←/→ move · W/↑ jump · S/↓ squat · J punch · K kick · L block (hold) · Space dodge · U special
// The how-to-play intro shows the first time only; after that, your record.
// Lose, and you can get back up (an ad; the 2nd time in a fight 2 ads...) or try again.

const KEYS = {
  KeyJ: "punch",
  KeyK: "kick",
  KeyU: "special",
  Space: "dodge",
  KeyW: "jump",
  ArrowUp: "jump",
};

const MOVE_LIST = [
  ["fist", "Punch", "quick and light; chain them into a combo"],
  [
    "boot",
    "Kick",
    "heavy, longer reach; if it's blocked you're open for a moment",
  ],
  ["up", "Jump (stick up)", "hop over a kick; punch or kick in the air for a flying kick"],
  ["shield", "Block (hold, or hold back)", "takes most of the sting out of any blow, even the special"],
  ["down", "Squat (stick down)", "duck under punches and the spin kick; kicks still land"],
  ["dodge", "Dodge", "a quick step back: nothing touches you"],
  ["bolt", "Special", "when the meter is full: the Lagos Roundabout"],
];

const SIZE = 64; // the badge canvas: a pixel portrait, scaled up crisply

/** A round portrait of a fighter: their own drawn face, worried when hurt. */
function Badge({ fx, facing, hp, max }) {
  const ref = useRef();
  const mood = hp <= 0 ? "out" : hp / max < 0.3 ? "hurt" : "fine";
  useEffect(() => {
    const c = ref.current;
    if (!c || !fx) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, SIZE, SIZE);
    drawPixelPortrait(g, fx, SIZE, { facing, mood });
  }, [fx, facing, mood]);
  return (
    <div className={`fight-badge ${mood}`}>
      <canvas ref={ref} width={SIZE} height={SIZE} />
    </div>
  );
}

function Bar({ value, max, color, label, right, fx }) {
  return (
    <div className={`fight-bar ${right ? "right" : ""}`}>
      <Badge fx={fx} facing={right ? -1 : 1} hp={value} max={max} />
      <div className="fight-bar-body">
        <div className="fight-name">{label}</div>
        <div className="fight-track">
          <div
            className="fight-fill"
            style={{
              width: `${Math.max(0, (value / max) * 100)}%`,
              background: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function HoldButton({ action, icon, label, className = "" }) {
  return (
    <button
      className={`fight-btn ${className}`}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.preventDefault();
        if (action === "block") fightInput.block = true;
        else if (action === "left") fightInput.move = -1;
        else if (action === "right") fightInput.move = 1;
        else fightInput[action] = true;
      }}
      onPointerUp={() => {
        if (action === "block") fightInput.block = false;
        if (action === "left" || action === "right") fightInput.move = 0;
      }}
      onPointerLeave={() => {
        if (action === "block") fightInput.block = false;
        if (action === "left" || action === "right") fightInput.move = 0;
      }}
    >
      <PixelIcon name={icon} size={className.includes("big") ? 44 : 32} />
    </button>
  );
}

// the stick: left/right walk, up jumps (once per push), down squats (held)
let stickUp = false;
function onStick(x, y) {
  fightInput.move = x > 0.35 ? 1 : x < -0.35 ? -1 : 0;
  const up = y > 0.55;
  if (up && !stickUp) fightInput.jump = true;
  stickUp = up;
  fightInput.crouch = y < -0.55;
}

export default function FightMode({ params, onFinish }) {
  const fight = useFight();
  const { touch } = useDevice();
  const [result, setResult] = useState(null);
  const [firstTime] = useState(() => !seenIntro("fight"));
  const [record] = useState(fightRecord);
  const [busy, setBusy] = useState(false);
  const adsNeeded = fight.revives + 1;
  const getBackUp = async () => {
    setBusy(true);
    let watched = 0;
    for (let i = 0; i < adsNeeded; i++) if (await showRewardedAd("revive:fight")) watched++; else break;
    setBusy(false);
    if (watched === adsNeeded) {
      setResult(null);
      useFight.getState().revive();
    }
  };
  const finish = () => {
    recordFight({ outcome: result.outcome, combo: fight.bestCombo });
    onFinish(result);
  };

  useEffect(() => {
    useFight.getState().start(params);
    return () => useFight.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fight.ended && !result) setResult(useFight.getState().result());
  }, [fight.ended, result]);

  useEffect(() => {
    const down = (e) => {
      if (KEYS[e.code]) {
        fightInput[KEYS[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === "KeyL") fightInput.block = true;
      if (e.code === "KeyS" || e.code === "ArrowDown") fightInput.crouch = true;
      if (e.code === "KeyA" || e.code === "ArrowLeft") fightInput.move = -1;
      if (e.code === "KeyD" || e.code === "ArrowRight") fightInput.move = 1;
    };
    const up = (e) => {
      if (e.code === "KeyL") fightInput.block = false;
      if (e.code === "KeyS" || e.code === "ArrowDown") fightInput.crouch = false;
      if ((e.code === "KeyA" || e.code === "ArrowLeft") && fightInput.move < 0)
        fightInput.move = 0;
      if ((e.code === "KeyD" || e.code === "ArrowRight") && fightInput.move > 0)
        fightInput.move = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  if (!fight.active) return null;
  const stage = <Fight2D params={params} key={fight.attempt} />;
  if (!fight.started)
    return (
      <>
        {stage}
        <div className="fee-intro">
          <h2>Fight! {fight.hud.name}</h2>
          {firstTime ? (
            <>
              <p>
                Punch, kick, block and dodge. Land hits to fill your meter, then
                unleash the <strong>Lagos Roundabout</strong>. Hits landed close
                together build a <strong>combo</strong>: each one hits harder.
              </p>
              <ul className="move-list">
                {MOVE_LIST.map(([icon, name, what]) => (
                  <li key={name}>
                    <PixelIcon name={icon} size={20} /> <strong>{name}</strong>: {what}
                  </li>
                ))}
              </ul>
              <p className="muted">
                The crowd throws money for good combos and specials: win, and the
                purse is yours.
                {!touch &&
                  " Keys: A/D move · W jump · S squat · J punch · K kick · L block (hold) · Space dodge · U special"}
              </p>
            </>
          ) : (
            <p className="fight-record">
              Your record: <strong>{record.won}</strong> won · {record.lost} lost · best combo{" "}
              <strong>x{record.bestCombo}</strong>
            </p>
          )}
          <PowerupOffer mode="fight" />
          <button
            className="btn btn-primary"
            onClick={() => {
              markIntroSeen("fight");
              fight.begin();
            }}
          >
            Oya!
          </button>
        </div>
      </>
    );
  if (fight.ended && result)
    return (
      <>
        {stage}
        <div className="fee-intro">
          <h2>
            {result.outcome === "won" ? "K.O.! You win!" : "You don fall..."}
          </h2>
          <p className="muted">
            Damage dealt {Math.round(fight.stats.dealt)} · taken{" "}
            {Math.round(fight.stats.taken)}
          </p>
          {fight.coins > 0 && (
            <p>
              {result.outcome === "won"
                ? `The crowd's money: ₦${(fight.coins * COIN).toLocaleString("en-NG")} is yours.`
                : `The crowd threw ₦${(fight.coins * COIN).toLocaleString("en-NG")}... the winner picks it up.`}
            </p>
          )}
          {result.outcome === "won" ? (
            <button className="btn btn-primary" onClick={finish}>
              Continue
            </button>
          ) : (
            <div className="result-actions">
              <button className="btn btn-primary" disabled={busy} onClick={getBackUp}>
                Get back up ({adsNeeded === 1 ? "watch an ad" : `watch ${adsNeeded} ads`})
              </button>
              <button
                className="btn"
                onClick={() => {
                  setResult(null);
                  fight.retry();
                }}
              >
                Try again
              </button>
              <button className="btn" onClick={finish}>
                Accept it and move on
              </button>
            </div>
          )}
        </div>
      </>
    );

  const { php, pmax, ohp, omax, special, name, combo = 0 } = fight.hud;
  // (the stage is the first thing in every branch, so it stays the same fight from intro to result)
  return (
    <>
      {stage}
      <div className="fight-hud">
        <Bar
          value={php}
          max={pmax}
          color="linear-gradient(#a8f56b, #3fbf3a)"
          label="You"
          fx={fight.looks?.p}
        />
        <div className="fight-vs">VS</div>
        <Bar
          value={ohp}
          max={omax}
          color="linear-gradient(#ff8a5c, #d9342b)"
          label={name}
          right
          fx={fight.looks?.o}
        />
      </div>
      <div
        className="fight-purse"
        key={fight.coins}
        aria-label="The crowd's money"
      >
        <span className="coin">₦</span>
        {(fight.coins * COIN).toLocaleString("en-NG")}
      </div>
      {combo >= 2 && (
        <div className="fight-combo" key={combo}>
          x{combo} <small>COMBO</small>
        </div>
      )}
      <div className="fight-special">
        <div
          style={{ width: `${special}%` }}
          className={special >= 100 ? "full" : ""}
        />
        <span>{special >= 100 ? "SPECIAL READY!" : "Special"}</span>
      </div>
      {touch ? (
        <div className="fight-controls">
          <div className="fight-move">
            <Joystick onMove={onStick} className="fight-stick" />
          </div>
          <div className="fight-actions">
            <HoldButton
              action="block"
              icon="shield"
              label="Block (hold)"
              className="block"
            />
            <HoldButton action="dodge" icon="dodge" label="Dodge" />
            <HoldButton action="jump" icon="up" label="Jump" />
            <HoldButton action="kick" icon="boot" label="Kick" />
            <HoldButton
              action="punch"
              icon="fist"
              label="Punch"
              className="big"
            />
            <HoldButton
              action="special"
              icon="bolt"
              label="Special move"
              className={special >= 100 ? "ready" : "dim"}
            />
          </div>
        </div>
      ) : (
        <div className="keyboard-hint">
          A/D move · W jump · S squat · J punch · K kick · L block · Space dodge
          · U special
        </div>
      )}
      {import.meta.env.DEV && (
        <button
          className="btn btn-small dev-end"
          onClick={() => fight.end("won")}
        >
          Win (dev)
        </button>
      )}
    </>
  );
}
