import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { formatNaira } from '../../game/narrative/stats.js'
import characters from '../../game/data/characters.json'
import { useOnline, say, challenge, answerInvite, bet, joinGroup, leaveGroup, claimQuest, buy, askLeaders, clearEnd, dismissToast, createRoom, joinRoom, leaveRoom, give, askBoard, buyProperty, furnish, unfurnish, visit } from '../../game/online/net.js'
import { whatsappLink, shareRoom, copyRoomLink } from '../../game/online/invite.js'
import { openShareCard } from '../share/shareCard.js'
import { useInterior } from '../../game/world/interiors/interiorStore.js'
import { playerState } from '../../game/world/worldState.js'
import { MODELS } from '../../assets/assetManifest.js'
import { DUEL_GAMES, GROUPS, QUESTS, SHOP, MAPS, MAX_STAKE, QUEST_GIVERS, giverState, PROPERTIES, FURNITURE_SHOP, MAX_FURNITURE } from '../../game/online/catalog.js'

// Lagos Online, on top of the street: who you are and what you have, the
// people here, chat, challenges and bets, groups, quests, the shop and the
// leaderboards. Matches you accept start here too.

const TABS = [
  ['room', '🔑', 'Room & invites'],
  ['board', '📊', 'Live board'],
  ['places', '🏠', 'Places'],
  ['people', '👥', 'People'],
  ['chat', '💬', 'Chat'],
  ['bets', '🎲', 'Matches & bets'],
  ['quests', '📜', 'Quests'],
  ['groups', '🤝', 'Groups'],
  ['shop', '🛍', 'Shop'],
  ['leaders', '🏆', 'Leaders'],
]
const who = (id) => characters[id]?.name || id
let localToast = 0
const addLocalToast = (text) => useOnline.setState((s) => ({ toasts: [...s.toasts, { id: `l${++localToast}`, text }].slice(-4) }))

/** Starts the game for a match the server just made (yours, both sides). */
function useMatchStarter() {
  const match = useOnline((s) => s.match)
  const started = useRef(null)
  useEffect(() => {
    if (!match || match.over || started.current === match.id) return
    started.current = match.id
    const def = DUEL_GAMES[match.game]
    const opp = match.players[1 - match.seat]?.name || 'them'
    const online = { matchId: match.id, kind: match.kind }
    const a =
      match.kind === 'live'
        ? { id: `online-${match.id}`, mode: match.game, label: `${def.name} vs ${opp}`, params: { remote: true, seat: match.seat, name: opp, recreational: true, online } }
        : { id: `online-${match.id}`, mode: def.mode, label: `${def.name} duel vs ${opp}`, params: { ...(def.params || {}), seed: match.seed, level: 0.35, recreational: true, online } }
    useGameStore.getState().startActivity({ ...a, key: `${a.id}-${Date.now()}` })
  }, [match])
}

/** The other player gave up or left a live game: close the board. */
function useLiveEndCloser() {
  const end = useOnline((s) => s.lastEnd)
  useEffect(() => {
    if (!end) return
    const { activity, finishActivity } = useGameStore.getState()
    const on = activity?.params?.online
    if (on?.kind === 'live' && on.matchId === end.id && /gave up|left/.test(end.why)) finishActivity({ outcome: 'over', score: 0 })
  }, [end])
}

function Stake({ value, onChange, max }) {
  return (
    <label className="ol-stake">
      ₦
      <input type="number" inputMode="numeric" min={0} max={max} step={100} value={value} onChange={(e) => onChange(Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))))} />
    </label>
  )
}

function People({ me }) {
  const players = useOnline((s) => s.players)
  const [open, setOpen] = useState(null)
  const [game, setGame] = useState('draughts')
  const [stake, setStake] = useState(500)
  const [gift, setGift] = useState(1000)
  const list = Object.values(players)
  const max = Math.min(MAX_STAKE, me.money)
  if (!list.length) return <p className="muted">Nobody else here right now. Take a bus to another place, or share the game with friends.</p>
  return (
    <div className="ol-list">
      {list.map((p) => (
        <div key={p.id} className="ol-row">
          <div className="ol-info">
            <strong>{p.name}</strong>
            <small>
              {GROUPS[p.group]?.name || 'No group'} · {p.wins || 0} wins
            </small>
          </div>
          <div className="ol-btns">
            <button className="btn btn-small btn-primary" onClick={() => setOpen(open === p.id ? null : p.id)}>
              Challenge
            </button>
            <button className="btn btn-small" onClick={() => setOpen(open === `give-${p.id}` ? null : `give-${p.id}`)}>
              Send ₦
            </button>
            {(p.places || []).map((id) => (
              <button key={id} className="btn btn-small" onClick={() => visit(p.id, id)} title={PROPERTIES[id]?.name}>
                Visit their {PROPERTIES[id]?.name.split(',')[0].toLowerCase() || 'place'}
              </button>
            ))}
          </div>
          {open === `give-${p.id}` && (
            <div className="ol-form">
              <span className="muted">Send {p.name}</span>
              <Stake value={Math.min(gift, me.money)} onChange={setGift} max={Math.min(50000, me.money)} />
              <button
                className="btn btn-small btn-primary"
                disabled={gift < 100 || gift > me.money}
                onClick={() => {
                  give(p.id, Math.min(gift, me.money))
                  setOpen(null)
                }}
              >
                Send
              </button>
            </div>
          )}
          {open === p.id && (
            <div className="ol-form">
              <select value={game} onChange={(e) => setGame(e.target.value)}>
                {Object.entries(DUEL_GAMES).map(([id, g]) => (
                  <option key={id} value={id}>
                    {g.name} {g.kind === 'live' ? '(turn by turn)' : '(best score)'}
                  </option>
                ))}
              </select>
              <Stake value={Math.min(stake, max)} onChange={setStake} max={max} />
              <button
                className="btn btn-small btn-primary"
                onClick={() => {
                  challenge(p.id, game, Math.min(stake, max))
                  setOpen(null)
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Chat() {
  const chat = useOnline((s) => s.chat)
  const [text, setText] = useState('')
  const end = useRef()
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [chat.length])
  return (
    <div className="ol-chat">
      <div className="ol-chat-log">
        {chat.length === 0 && <p className="muted">Say hello. Be nice: Baba Radio is listening.</p>}
        {chat.map((c, i) => (
          <p key={i} className={c.id === 'news' ? 'ol-news' : ''}>
            <strong>{c.name}:</strong> {c.text}
          </p>
        ))}
        <div ref={end} />
      </div>
      <form
        className="ol-chat-say"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) say(text.trim())
          setText('')
        }}
      >
        <input value={text} maxLength={120} placeholder="How far?" onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-small btn-primary">Send</button>
      </form>
    </div>
  )
}

function Bets({ me }) {
  const matches = useOnline((s) => s.matches)
  const [amount, setAmount] = useState(500)
  const max = Math.min(MAX_STAKE, me.money)
  if (!matches.length) return <p className="muted">No matches on here right now. Challenge somebody, or wait for one and back a winner.</p>
  return (
    <div className="ol-list">
      <p className="muted">Everyone who backs the winner shares the whole pool.</p>
      <Stake value={Math.min(amount, max)} onChange={setAmount} max={max} />
      {matches.map((m) => {
        const mine = m.players.some((p) => p.id === me.id)
        return (
          <div key={m.id} className="ol-row">
            <div className="ol-info">
              <strong>
                {m.players[0].name} vs {m.players[1].name}
              </strong>
              <small>
                {m.gameName}
                {m.stake ? ` · ${formatNaira(m.stake)} each` : ''} · pool {formatNaira(m.pool[0])} / {formatNaira(m.pool[1])}
              </small>
            </div>
            {mine ? (
              <small className="muted">your match</small>
            ) : (
              <div className="ol-btns">
                {[0, 1].map((k) => (
                  <button key={k} className="btn btn-small" disabled={amount < 100 || amount > me.money} onClick={() => bet(m.id, k, Math.min(amount, max))}>
                    On {m.players[k].name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Quests({ me }) {
  const boost = GROUPS[me.group]?.perk?.quests || 0
  const near = useOnline((s) => s.nearGiver)
  const guide = useOnline((s) => s.guide)
  const map = useOnline((s) => s.map)
  // the person you're talking to first
  const list = [...QUESTS].sort((a, b) => (b.from === near) - (a.from === near))
  return (
    <div className="ol-list">
      <p className="muted">{near ? `${who(near)} is listening.` : 'New every day. Do the job anywhere, then go to the person to collect. ! = a job going, ✓ = money waiting.'}</p>
      {list.map((q) => {
        const n = Math.min(q.goal.count, me.quests?.progress?.[q.id] || 0)
        const done = n >= q.goal.count
        const claimed = me.quests?.claimed?.[q.id]
        const g = QUEST_GIVERS[q.from]
        const here = near === q.from
        return (
          <div key={q.id} className={`ol-row ${claimed ? 'ol-done' : ''} ${here ? 'ol-mine' : ''}`}>
            <div className="ol-info">
              <strong>
                {who(q.from)} <small>({q.story})</small>
              </strong>
              <small>{q.text}</small>
              <small>
                {n}/{q.goal.count} · {formatNaira(Math.round(q.reward * (1 + boost)))}
              </small>
              {!claimed && !here && g && <small className="ol-where">📍 {MAPS[g.map].name}, {g.place}</small>}
            </div>
            {claimed ? (
              <span className="ol-tick">✓</span>
            ) : here ? (
              <button className="btn btn-small btn-primary" disabled={!done} onClick={() => claimQuest(q.id)}>
                {done ? 'Collect' : 'Not done'}
              </button>
            ) : (
              <button
                className={`btn btn-small ${done ? 'btn-primary' : ''}`}
                onClick={() => {
                  useOnline.setState({ guide: guide === q.from ? null : q.from })
                  if (g && g.map !== map) addLocalToast(`${who(q.from)} is in ${MAPS[g.map].name}. Take the bus there, then follow the arrow.`)
                }}
              >
                {guide === q.from ? 'Stop guiding' : done ? 'Go collect' : 'Show the way'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Groups({ me }) {
  return (
    <div className="ol-list">
      <p className="muted">One group at a time. Joining is free; members get the perk.</p>
      {Object.entries(GROUPS).map(([id, g]) => (
        <div key={id} className={`ol-row ${me.group === id ? 'ol-mine' : ''}`}>
          <div className="ol-info">
            <strong>{g.name}</strong>
            <small>
              {g.story} · led by {who(g.leader)} · “{g.blurb}”
            </small>
            <small className="ol-perk">{g.perkText}</small>
          </div>
          {me.group === id ? (
            <button className="btn btn-small" onClick={leaveGroup}>
              Leave
            </button>
          ) : (
            <button className="btn btn-small btn-primary" onClick={() => joinGroup(id)}>
              Join
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function Shop({ me }) {
  const off = GROUPS[me.group]?.perk?.shop || 0
  return (
    <div className="ol-list">
      <p className="muted">Small advantages and fine clothes. Naira earned in Lagos Online only.</p>
      {Object.entries(SHOP).map(([id, it]) => {
        const price = Math.round(it.price * (1 - off))
        const have = me.items?.[id]
        return (
          <div key={id} className="ol-row">
            <div className="ol-info">
              <strong>{it.name}</strong>
              <small>{it.text}</small>
              <small>
                {formatNaira(price)}
                {off ? ' (group discount)' : ''}
                {it.kind === 'uses' && have ? ` · you have ${have}` : ''}
              </small>
            </div>
            {it.kind !== 'uses' && have ? (
              <span className="ol-tick">✓</span>
            ) : (
              <button className="btn btn-small btn-primary" disabled={price > me.money} onClick={() => buy(id)}>
                Buy
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Room({ me }) {
  const lobby = useOnline((s) => s.lobby)
  const [code, setCode] = useState('')
  const [note, setNote] = useState(null)
  if (!lobby)
    return (
      <div className="ol-list">
        <p className="muted">You're on the public street with everybody. Open a private room for you and your friends: they join with its 4-letter code.</p>
        <button className="btn btn-primary" onClick={createRoom}>
          Open a private room
        </button>
        <form
          className="ol-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === 4) joinRoom(code)
          }}
        >
          <input className="ol-code" value={code} maxLength={4} placeholder="CODE" aria-label="Room code" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} />
          <button className="btn btn-small btn-primary" disabled={code.length !== 4}>
            Join room
          </button>
        </form>
      </div>
    )
  return (
    <div className="ol-list">
      <div className="ol-room-code">
        <small>Room code</small>
        <b>{lobby.code}</b>
        <small>{lobby.host === me.id ? 'Your room' : `${lobby.hostName}'s room`}</small>
      </div>
      <div className="ol-btns ol-invite-btns">
        <a className="btn btn-whatsapp" href={whatsappLink(lobby.code)} target="_blank" rel="noopener noreferrer">
          WhatsApp invite
        </a>
        <button className="btn" onClick={async () => setNote((await shareRoom(lobby.code)) === 'copied' ? 'Invite copied: paste it anywhere.' : null)}>
          Share…
        </button>
        <button className="btn" onClick={async () => setNote((await copyRoomLink(lobby.code)) === 'copied' ? 'Invite copied: paste it anywhere.' : "Couldn't copy here: send the code.")}>
          Copy link
        </button>
      </div>
      {note && <p className="muted">{note}</p>}
      <h3>In the room ({lobby.members.length})</h3>
      {lobby.members.map((m) => (
        <div key={m.id} className="ol-row">
          <div className="ol-info">
            <strong>
              {m.name}
              {m.id === lobby.host ? ' (host)' : ''}
              {m.id === me.id ? ' (you)' : ''}
            </strong>
            <small>{MAPS[m.map]?.name || 'arriving…'}</small>
          </div>
        </div>
      ))}
      <button className="btn btn-small" onClick={leaveRoom}>
        Leave the room (back to the public street)
      </button>
    </div>
  )
}

function Places({ me }) {
  const owned = me.properties || {}
  return (
    <div className="ol-list">
      <p className="muted">Buy a place, walk in through its door, and furnish it. Friends in your room can visit (People → Visit).</p>
      {Object.entries(PROPERTIES).map(([id, pl]) => (
        <div key={id} className={`ol-row ${owned[id] ? 'ol-mine' : ''}`}>
          <div className="ol-info">
            <strong>{pl.name}</strong>
            <small>{pl.blurb}</small>
            <small>
              {pl.size} m² · {owned[id] ? `yours · ${owned[id].furniture.length} pieces of furniture · its door is in ${MAPS[pl.map].name}` : `${formatNaira(pl.price)} · in ${MAPS[pl.map].name}`}
            </small>
          </div>
          {owned[id] ? (
            <span className="ol-tick">✓</span>
          ) : (
            <button className="btn btn-small btn-primary" disabled={pl.price > me.money} onClick={() => buyProperty(id)}>
              Buy
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

const furnitureName = (m) => (MODELS[m]?.use || m).split(/[:(,]/)[0].trim()

/** Inside your own place: put furniture down in front of you, or take it back out. */
function Furnish({ me, id }) {
  const placed = me.properties?.[id]?.furniture || []
  const put = (model) => {
    const p = playerState.position
    const f = playerState.facing
    // a step and a bit in front of you, turned to face you
    furnish(id, model, p.x + Math.sin(f) * 1.4, p.z + Math.cos(f) * 1.4, Math.round(((f * 180) / Math.PI + 180) / 15) * 15)
  }
  return (
    <div className="ol-list">
      <p className="muted">
        It goes down in front of you, facing you: walk to where you want it first. {placed.length}/{MAX_FURNITURE} pieces. Taking one out gives half its price back.
      </p>
      <div className="ol-furn-grid">
        {Object.entries(FURNITURE_SHOP).map(([model, price]) => (
          <button key={model} className="btn btn-small" disabled={price > me.money || placed.length >= MAX_FURNITURE} onClick={() => put(model)}>
            {furnitureName(model)}
            <small>{formatNaira(price)}</small>
          </button>
        ))}
      </div>
      {placed.length > 0 && <h3>In here</h3>}
      {placed.map((f, i) => (
        <div key={`${i}-${f.model}`} className="ol-row">
          <div className="ol-info">
            <strong>{furnitureName(f.model)}</strong>
          </div>
          <button className="btn btn-small" onClick={() => unfurnish(id, i)}>
            Take out
          </button>
        </div>
      ))}
    </div>
  )
}

const METRICS = [
  ['worth', 'Net worth', formatNaira],
  ['respect', 'Respect', (v) => v],
  ['influence', 'Influence', (v) => v],
  ['heists', 'Heists & turf', (v) => v],
]

function Board({ me }) {
  const rows = useOnline((s) => s.board)
  const lobby = useOnline((s) => s.lobby)
  const [metric, setMetric] = useState('worth')
  useEffect(() => {
    askBoard()
  }, [])
  const [, label, fmt] = METRICS.find((m) => m[0] === metric)
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric] || b.worth - a.worth)
  return (
    <div>
      <p className="muted">{lobby ? `Everyone in room ${lobby.code}, live.` : 'The top 20 on the public street right now, live.'}</p>
      <div className="ol-metrics" role="tablist">
        {METRICS.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={metric === id} className={`chip ${metric === id ? 'on' : ''}`} onClick={() => setMetric(id)}>
            {name}
          </button>
        ))}
      </div>
      <ol className="ol-board ol-live">
        {sorted.map((r) => (
          <li key={r.id} className={r.id === me.id ? 'is-me' : ''}>
            <span>
              {r.name}
              {GROUPS[r.group] ? <small> · {GROUPS[r.group].name}</small> : null}
            </span>
            <b title={label}>{fmt(r[metric])}</b>
          </li>
        ))}
      </ol>
      <p className="muted ol-how">Net worth: cash and what you own. Respect: matches won, Back Gate nights, quests. Influence: political favours and sharing money. Heists: Back Gate nights (turf wars and heists are coming).</p>
    </div>
  )
}

function Leaders() {
  const leaders = useOnline((s) => s.leaders)
  useEffect(() => {
    askLeaders()
  }, [])
  if (!leaders) return <p className="muted">Loading…</p>
  const list = (rows, fmt) => (
    <ol className="ol-board">
      {rows.map((r, i) => (
        <li key={i}>
          <span>{r.name}</span>
          <b>{fmt(r.value)}</b>
        </li>
      ))}
    </ol>
  )
  return (
    <div>
      <h3>Net worth</h3>
      {list(leaders.richest, formatNaira)}
      <h3>Street respect</h3>
      {list(leaders.respected || [], (v) => v)}
      <h3>Political influence</h3>
      {list(leaders.influential || [], (v) => v)}
      <h3>Heists &amp; turf</h3>
      {list(leaders.heists || [], (v) => v)}
      <h3>Most wins</h3>
      {list(leaders.winners, (v) => v)}
      <h3>Groups (wins)</h3>
      {list(leaders.groups.map((g) => ({ name: `${g.name} (${g.members})`, value: g.value })), (v) => v)}
    </div>
  )
}

function Invites() {
  const invites = useOnline((s) => s.invites)
  const inv = invites[0]
  if (!inv) return null
  return (
    <div className="ol-invite">
      <p>
        <strong>{inv.name}</strong> challenges you to <strong>{inv.gameName}</strong>
        {inv.stake ? ` for ${formatNaira(inv.stake)}` : ''}.
      </p>
      <div className="ol-btns">
        <button className="btn btn-small btn-primary" onClick={() => answerInvite(inv.id, true)}>
          Accept
        </button>
        <button className="btn btn-small" onClick={() => answerInvite(inv.id, false)}>
          No thanks
        </button>
      </div>
    </div>
  )
}

function MatchEnd({ me }) {
  const end = useOnline((s) => s.lastEnd)
  const busy = useGameStore((s) => Boolean(s.activity))
  if (!end || busy) return null
  const got = end.payouts?.[me.id] || 0
  const won = end.winner === me.id
  return (
    <div className="overlay" onClick={clearEnd}>
      <div className="panel ol-end" onClick={(e) => e.stopPropagation()}>
        <h2>{!end.winner ? 'A draw' : won ? 'You win!' : `${end.winnerName} wins`}</h2>
        <p>
          {end.gameName}: {end.players[0].name} vs {end.players[1].name} ({end.why})
        </p>
        {got > 0 && <p className="arcade-pay">{end.winner ? '+' : 'Stake back: '}{formatNaira(got)}</p>}
        {won && (
          <button
            className="btn"
            onClick={() => {
              const opp = end.players.find((p) => p.id !== me.id)?.name || 'them'
              clearEnd()
              openShareCard({ kicker: `Lagos Online · ${end.gameName}`, title: `Beat ${opp}`, line: end.why, stats: [['Won', formatNaira(got)], ['Wins', me.stats?.wins ?? 0], ['Respect', me.stats?.respect ?? 0]], tone: 'green' })
            }}
          >
            Share the win
          </button>
        )}
        <button className="btn btn-primary" onClick={clearEnd}>
          OK
        </button>
      </div>
    </div>
  )
}

function Toasts() {
  const toasts = useOnline((s) => s.toasts)
  useEffect(() => {
    if (!toasts.length) return undefined
    const id = setTimeout(() => dismissToast(toasts[0].id), 4000)
    return () => clearTimeout(id)
  }, [toasts])
  return (
    <div className="ol-toasts">
      {toasts.map((t) => (
        <div key={t.id} className="ol-toast" onClick={() => dismissToast(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** The last couple of chat lines, briefly, while no panel is open. */
function ChatTicker({ onOpen }) {
  const chat = useOnline((s) => s.chat)
  const [shown, setShown] = useState(false)
  const last = chat[chat.length - 1]
  useEffect(() => {
    if (!last) return undefined
    setShown(true)
    const id = setTimeout(() => setShown(false), 6000)
    return () => clearTimeout(id)
  }, [last])
  if (!shown || !last) return null
  return (
    <button className="ol-ticker" onClick={onOpen}>
      {chat.slice(-2).map((c, i) => (
        <span key={i}>
          <strong>{c.name}:</strong> {c.text}
        </span>
      ))}
    </button>
  )
}

export default function OnlineHUD({ onMenu, hidden = false }) {
  const status = useOnline((s) => s.status)
  const error = useOnline((s) => s.error)
  const me = useOnline((s) => s.me)
  const map = useOnline((s) => s.map)
  const count = useOnline((s) => Object.keys(s.players).length)
  const invites = useOnline((s) => s.invites.length)
  const matches = useOnline((s) => s.matches.length)
  const activity = useGameStore((s) => s.activity)
  const nearGiver = useOnline((s) => s.nearGiver)
  const lobby = useOnline((s) => s.lobby)
  const insideId = useInterior((s) => s.id)
  const insideOwner = useInterior((s) => s.owner)
  const visiting = useOnline((s) => s.visiting)
  const myPlace = insideId && !insideOwner && me?.properties?.[insideId] ? insideId : null
  const [tab, setTab] = useState(null)
  useMatchStarter()
  useLiveEndCloser()
  // the shop's clothes: wear them in the street too
  const look = me?.look
  useEffect(() => {
    if (!look) return
    const { game } = useGameStore.getState()
    if (game && JSON.stringify({ ...(game.player.look || {}), ...look }) !== JSON.stringify(game.player.look || {})) useGameStore.setState({ game: { ...game, player: { ...game.player, look: { ...(game.player.look || {}), ...look } } } })
  }, [look])

  const bar = (
    <div className="ol-bar">
      <span className={`ol-dot ol-${status}`} title={status} />
      {me ? (
        <>
          <strong>{me.name}</strong>
          <span className="ol-money">{formatNaira(me.money)}</span>
          <small>
            {MAPS[map]?.name || '…'} · {count + 1} here
            {lobby ? (
              <button className="ol-room-chip" onClick={() => setTab('room')} title="Room and invites">
                🔑 {lobby.code}
              </button>
            ) : null}
          </small>
        </>
      ) : (
        <small>{status === 'error' ? error : 'Connecting…'}</small>
      )}
    </div>
  )

  if (activity || hidden)
    return (
      <>
        <Invites />
        <Toasts />
      </>
    )
  return (
    <>
      <div className="hud hud-online">
        <div className="hud-left">{bar}</div>
        <div className="hud-right">
          <button className="icon-btn" onClick={onMenu} aria-label="Menu" title="Menu">
            ☰
          </button>
        </div>
      </div>
      {me && (
        <div className="ol-tabs">
          {TABS.map(([id, icon, label]) => (
            <button key={id} className={`ol-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(tab === id ? null : id)} title={label} aria-label={label}>
              {icon}
              {id === 'bets' && matches > 0 && <i className="ol-badge">{matches}</i>}
              {id === 'people' && invites > 0 && <i className="ol-badge">!</i>}
            </button>
          ))}
        </div>
      )}
      {!tab && <ChatTicker onOpen={() => setTab('chat')} />}
      {myPlace && tab !== 'furnish' && (
        <button className="ol-talk ol-furnish" onClick={() => setTab('furnish')}>
          🛋 Furnish your place
        </button>
      )}
      {insideOwner && visiting && <div className="ol-visiting">{visiting.ownerName}'s place</div>}
      {nearGiver && me && tab !== 'quests' && (
        <button className={`ol-talk ${giverState(nearGiver, me) === 'ready' ? 'is-ready' : ''}`} onClick={() => setTab('quests')}>
          💬 Talk to {who(nearGiver)}
          {giverState(nearGiver, me) === 'ready' && <small>money waiting</small>}
        </button>
      )}
      {tab && me && (
        <div className="ol-panel">
          <div className="panel-head">
            <h2>{tab === 'furnish' ? 'Furnish your place' : TABS.find((t) => t[0] === tab)?.[2]}</h2>
            <button className="icon-btn" onClick={() => setTab(null)} aria-label="Close">
              ✕
            </button>
          </div>
          {tab === 'room' && <Room me={me} />}
          {tab === 'places' && <Places me={me} />}
          {tab === 'furnish' && myPlace && <Furnish me={me} id={myPlace} />}
          {tab === 'board' && <Board me={me} />}
          {tab === 'people' && <People me={me} />}
          {tab === 'chat' && <Chat />}
          {tab === 'bets' && <Bets me={me} />}
          {tab === 'quests' && <Quests me={me} />}
          {tab === 'groups' && <Groups me={me} />}
          {tab === 'shop' && <Shop me={me} />}
          {tab === 'leaders' && <Leaders />}
        </div>
      )}
      <Invites />
      {me && <MatchEnd me={me} />}
      <Toasts />
    </>
  )
}
