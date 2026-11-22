import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../game/store/gameStore.js'
import { formatNaira } from '../../game/narrative/stats.js'
import characters from '../../game/data/characters.json'
import { useOnline, say, challenge, answerInvite, bet, joinGroup, leaveGroup, claimQuest, buy, askLeaders, clearEnd, dismissToast } from '../../game/online/net.js'
import { DUEL_GAMES, GROUPS, QUESTS, SHOP, MAPS, MAX_STAKE } from '../../game/online/catalog.js'

// Lagos Online, on top of the street: who you are and what you have, the
// people here, chat, challenges and bets, groups, quests, the shop and the
// leaderboards. Matches you accept start here too.

const TABS = [
  ['people', '👥', 'People'],
  ['chat', '💬', 'Chat'],
  ['bets', '🎲', 'Matches & bets'],
  ['quests', '📜', 'Quests'],
  ['groups', '🤝', 'Groups'],
  ['shop', '🛍', 'Shop'],
  ['leaders', '🏆', 'Leaders'],
]
const who = (id) => characters[id]?.name || id

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
          <button className="btn btn-small btn-primary" onClick={() => setOpen(open === p.id ? null : p.id)}>
            Challenge
          </button>
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
  return (
    <div className="ol-list">
      <p className="muted">New every day. People from the stories want things done.</p>
      {QUESTS.map((q) => {
        const n = Math.min(q.goal.count, me.quests?.progress?.[q.id] || 0)
        const done = n >= q.goal.count
        const claimed = me.quests?.claimed?.[q.id]
        return (
          <div key={q.id} className={`ol-row ${claimed ? 'ol-done' : ''}`}>
            <div className="ol-info">
              <strong>
                {who(q.from)} <small>({q.story})</small>
              </strong>
              <small>{q.text}</small>
              <small>
                {n}/{q.goal.count} · {formatNaira(Math.round(q.reward * (1 + boost)))}
              </small>
            </div>
            {claimed ? (
              <span className="ol-tick">✓</span>
            ) : (
              <button className="btn btn-small btn-primary" disabled={!done} onClick={() => claimQuest(q.id)}>
                Claim
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
      <h3>Richest</h3>
      {list(leaders.richest, formatNaira)}
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
      {tab && me && (
        <div className="ol-panel">
          <div className="panel-head">
            <h2>{TABS.find((t) => t[0] === tab)[2]}</h2>
            <button className="icon-btn" onClick={() => setTab(null)} aria-label="Close">
              ✕
            </button>
          </div>
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
