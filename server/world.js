// Lagos Online: the shared world's rules, with no networking in it (index.js
// does the sockets). Every message from a player goes through handle(), and
// every reply is pushed through the send(clientId, msg) function it was given,
// so the whole thing can be tested without a network.
//
// Players are guests: a private token (kept on their device) finds their
// profile again. Money is in-game naira only.
import { START_MONEY, DAILY_BONUS, MAX_STAKE, MAPS, DUEL_GAMES, GROUPS, QUESTS, SHOP, groupWinBonus, questCounts } from '../src/game/online/catalog.js'
import { turnsFor, VARIANTS, initialBoard } from '../src/game/modes/arcade/games/draughts.js'
import { play as ayoPlay, legal as ayoLegal } from '../src/game/modes/arcade/games/ayo.js'

const today = (now) => new Date(now).toISOString().slice(0, 10)
const clean = (s, n) =>
  [...String(s ?? '')]
    .filter((ch) => ch >= ' ' && ch !== '<' && ch !== '>') // no control characters or tags
    .join('')
    .trim()
    .slice(0, n)
const BAD = /\b(fuck|shit|bitch|nigger|cunt)\b/gi // keep the street talk, lose the worst words
const DUEL_TIMEOUT = 6 * 60 * 1000
const LEAVE_GRACE = 45 * 1000 // a dropped phone gets this long to come back to a live match

export class World {
  constructor({ store, send, now = () => Date.now(), random = Math.random } = {}) {
    this.store = store // { players: { [token]: profile } }, save()
    this.send = send
    this.now = now
    this.random = random
    this.clients = new Map() // clientId -> { token, id, map, x, z, ry, anim, lastSay, lastMove }
    this.invites = new Map()
    this.matches = new Map()
    this.seq = 1
  }

  // ---------------------------------------------------------------- helpers
  profile(cid) {
    const c = this.clients.get(cid)
    return c && this.store.players[c.token]
  }
  clientOf(playerId) {
    for (const [cid, c] of this.clients) if (c.id === playerId) return cid
    return null
  }
  publicOf(p, c) {
    return { id: p.id, name: p.name, look: p.look, group: p.group || null, x: c?.x ?? 0, z: c?.z ?? 0, ry: c?.ry ?? 0, anim: c?.anim || 'idle', wins: p.stats.wins }
  }
  toRoom(map, msg, except = null) {
    for (const [cid, c] of this.clients) if (c.map === map && cid !== except) this.send(cid, msg)
  }
  meMsg(p) {
    const me = { ...p }
    delete me.token // the private token never leaves the server
    return { t: 'me', me }
  }
  pushMe(cid) {
    const p = this.profile(cid)
    if (p) this.send(cid, this.meMsg(p))
  }
  toast(cid, text) {
    this.send(cid, { t: 'toast', text })
  }
  err(cid, text) {
    this.send(cid, { t: 'error', text })
  }
  save() {
    this.store.save?.()
  }
  /** Count something a player did towards today's quests. */
  progress(p, ev) {
    this.resetDaily(p)
    for (const q of QUESTS) if (questCounts(q, ev)) p.quests.progress[q.id] = (p.quests.progress[q.id] || 0) + 1
  }
  resetDaily(p) {
    const d = today(this.now())
    if (p.quests.day !== d) p.quests = { day: d, progress: {}, claimed: {} }
  }

  // ---------------------------------------------------------------- connections
  connect(cid) {
    this.clients.set(cid, { token: null, id: null, map: null, x: 0, z: 0, ry: 0, anim: 'idle', lastSay: 0, lastMove: 0 })
  }
  disconnect(cid) {
    const c = this.clients.get(cid)
    if (!c) return
    if (c.map) this.toRoom(c.map, { t: 'left', id: c.id }, cid)
    // live matches: a short grace to come back, then it's a forfeit
    for (const m of this.matches.values())
      if (m.kind === 'live' && !m.over && m.players.some((pl) => pl.id === c.id)) {
        m.awayTimer = setTimeout(() => {
          if (!this.clientOf(c.id) && !m.over) this.finish(m, m.players.find((pl) => pl.id !== c.id).id, 'left the match')
        }, LEAVE_GRACE)
        m.awayTimer?.unref?.()
      }
    this.clients.delete(cid)
  }

  handle(cid, msg) {
    if (!msg || typeof msg.t !== 'string') return
    const c = this.clients.get(cid)
    if (!c) return
    if (msg.t === 'hello') return this.hello(cid, msg)
    if (!c.token) return this.err(cid, 'Say hello first.')
    const fn = {
      join: this.join,
      move: this.move,
      say: this.say,
      challenge: this.challenge,
      respond: this.respond,
      liveMove: this.liveMove,
      duelResult: this.duelResult,
      bet: this.bet,
      soloResult: this.soloResult,
      joinGroup: this.joinGroup,
      leaveGroup: this.leaveGroup,
      claimQuest: this.claimQuest,
      buy: this.buy,
      useToken: this.useToken,
      leaders: this.leaders,
      forfeit: this.forfeit,
    }[msg.t]
    if (fn) fn.call(this, cid, msg)
  }

  hello(cid, { token, name, look }) {
    const c = this.clients.get(cid)
    const tk = clean(token, 64)
    if (tk.length < 16) return this.err(cid, 'Bad token.')
    let p = this.store.players[tk]
    if (!p) {
      p = this.store.players[tk] = {
        token: tk,
        id: `p${Object.keys(this.store.players).length + 1}${Math.floor(this.random() * 1e4)}`,
        name: 'Guest',
        look: {},
        money: START_MONEY,
        group: null,
        items: {},
        stats: { wins: 0, losses: 0, played: 0, betsWon: 0 },
        quests: { day: today(this.now()), progress: {}, claimed: {} },
        lastDaily: null,
        created: this.now(),
      }
    }
    const nm = clean(name, 16).replace(BAD, '***')
    if (nm.length >= 2) p.name = nm
    if (look && typeof look === 'object') p.look = { ...clean2(look), ...(p.lookExtra || {}) }
    // one connection per player: an old one is dropped
    for (const [other, oc] of this.clients) if (other !== cid && oc.token === tk) this.disconnect(other)
    c.token = tk
    c.id = p.id
    // a returning player in a live match: cancel the forfeit timer, resend the match
    for (const m of this.matches.values())
      if (!m.over && m.players.some((pl) => pl.id === p.id)) {
        clearTimeout(m.awayTimer)
        this.send(cid, { t: 'match', match: this.matchView(m, p.id) })
      }
    // the daily bonus
    const d = today(this.now())
    if (p.lastDaily !== d) {
      const extra = GROUPS[p.group]?.perk?.daily || 0
      p.money += DAILY_BONUS + extra
      p.lastDaily = d
      this.toast(cid, `Daily bonus: +₦${(DAILY_BONUS + extra).toLocaleString('en-NG')}`)
    }
    this.resetDaily(p)
    this.save()
    this.send(cid, { t: 'welcome', maps: Object.fromEntries(Object.keys(MAPS).map((m) => [m, [...this.clients.values()].filter((x) => x.map === m).length])) })
    this.pushMe(cid)
  }

  join(cid, { map, x = 0, z = 0 }) {
    if (!MAPS[map]) return this.err(cid, 'No such place.')
    const c = this.clients.get(cid)
    const p = this.profile(cid)
    if (c.map) this.toRoom(c.map, { t: 'left', id: c.id }, cid)
    Object.assign(c, { map, x: num(x), z: num(z) })
    const here = []
    for (const [other, oc] of this.clients) if (other !== cid && oc.map === map && oc.token) here.push(this.publicOf(this.store.players[oc.token], oc))
    this.send(cid, { t: 'room', map, players: here, matches: this.openMatches(map) })
    this.toRoom(map, { t: 'joined', player: this.publicOf(p, c) }, cid)
  }

  move(cid, { x, z, ry, anim }) {
    const c = this.clients.get(cid)
    if (!c.map) return
    const t = this.now()
    if (t - c.lastMove < 50) return // at most 20 a second
    c.lastMove = t
    Object.assign(c, { x: num(x), z: num(z), ry: num(ry), anim: clean(anim, 16) || 'idle' })
    this.toRoom(c.map, { t: 'moved', id: c.id, x: c.x, z: c.z, ry: c.ry, anim: c.anim }, cid)
  }

  say(cid, { text }) {
    const c = this.clients.get(cid)
    const p = this.profile(cid)
    if (!c.map) return
    const t = this.now()
    if (t - c.lastSay < 1000) return this.err(cid, 'Easy! One message a second.')
    c.lastSay = t
    const msg = clean(text, 120).replace(BAD, '***')
    if (!msg) return
    this.toRoom(c.map, { t: 'chat', id: p.id, name: p.name, group: p.group, text: msg, at: t })
  }

  // ---------------------------------------------------------------- challenges
  challenge(cid, { to, game, stake = 0 }) {
    const p = this.profile(cid)
    const g = DUEL_GAMES[game]
    if (!g) return this.err(cid, 'No such game.')
    const s = Math.max(0, Math.min(MAX_STAKE, Math.round(num(stake) / 100) * 100))
    if (s > p.money) return this.err(cid, "You don't have that much.")
    const tcid = this.clientOf(to)
    if (!tcid || to === p.id) return this.err(cid, "They're not around.")
    const id = `i${this.seq++}`
    this.invites.set(id, { id, from: p.id, to, game, stake: s, at: this.now() })
    this.send(tcid, { t: 'invite', id, from: p.id, name: p.name, game, gameName: g.name, stake: s })
    this.toast(cid, `Challenge sent: ${g.name}${s ? ` for ₦${s.toLocaleString('en-NG')}` : ''}.`)
  }

  respond(cid, { id, accept }) {
    const inv = this.invites.get(id)
    const p = this.profile(cid)
    if (!inv || inv.to !== p.id) return
    this.invites.delete(id)
    const fcid = this.clientOf(inv.from)
    if (!accept) {
      if (fcid) this.toast(fcid, `${p.name} said no to ${DUEL_GAMES[inv.game].name}.`)
      return
    }
    const a = fcid && this.store.players[this.clients.get(fcid).token]
    if (!a) return this.err(cid, 'They left.')
    if (a.money < inv.stake || p.money < inv.stake) {
      for (const x of [cid, fcid]) this.err(x, 'Somebody no get the money for that stake.')
      return
    }
    // both stakes held by the house until the end
    a.money -= inv.stake
    p.money -= inv.stake
    const g = DUEL_GAMES[inv.game]
    const m = {
      id: `m${this.seq++}`,
      game: inv.game,
      kind: g.kind,
      map: this.clients.get(fcid).map,
      stake: inv.stake,
      seed: Math.floor(this.random() * 99999) + 1,
      players: [
        { id: a.id, name: a.name },
        { id: p.id, name: p.name },
      ],
      scores: [null, null],
      bets: [],
      started: this.now(),
      over: false,
    }
    if (m.game === 'draughts') m.live = { board: initialBoard(VARIANTS.international), turn: 0, plies: 0, kingPlies: 0 }
    if (m.game === 'ayo') m.live = { board: new Array(12).fill(4), store: [0, 0], turn: 0, moves: 0 }
    if (m.kind === 'duel') {
      m.timer = setTimeout(() => this.settleDuel(m), DUEL_TIMEOUT)
      m.timer?.unref?.()
    }
    this.matches.set(m.id, m)
    for (const pl of m.players) {
      const x = this.clientOf(pl.id)
      if (x) {
        this.send(x, { t: 'match', match: this.matchView(m, pl.id) })
        this.pushMe(x)
      }
    }
    this.toRoom(m.map, { t: 'matches', matches: this.openMatches(m.map) })
    this.save()
  }

  matchView(m, viewer) {
    const seat = m.players.findIndex((pl) => pl.id === viewer)
    return { id: m.id, game: m.game, gameName: DUEL_GAMES[m.game].name, kind: m.kind, stake: m.stake, seed: m.seed, players: m.players, seat, over: m.over, live: m.live ? { turn: m.live.turn } : null }
  }
  openMatches(map) {
    return [...this.matches.values()].filter((m) => !m.over && m.map === map).map((m) => ({ id: m.id, game: m.game, gameName: DUEL_GAMES[m.game].name, stake: m.stake, players: m.players, pool: [0, 1].map((k) => m.bets.filter((b) => b.on === k).reduce((a, b) => a + b.amount, 0)) }))
  }

  // ---------------------------------------------------------------- live board games
  /** A move in a live game, from the mover's own point of view (they always play from the bottom). */
  liveMove(cid, { id, move }) {
    const m = this.matches.get(id)
    const p = this.profile(cid)
    if (!m || m.over || !m.live) return
    const seat = m.players.findIndex((pl) => pl.id === p.id)
    if (seat < 0 || m.live.turn !== seat) return this.err(cid, 'Not your turn.')
    const ok = m.game === 'draughts' ? this.draughtsMove(m, seat, move) : this.ayoMove(m, seat, move)
    if (!ok) return this.err(cid, 'That move is not allowed.')
    // the other player gets the move in their own point of view
    const other = m.players[1 - seat]
    const ocid = this.clientOf(other.id)
    if (ocid) this.send(ocid, { t: 'liveMove', id: m.id, move: flipMove(m.game, move) })
    this.checkLiveEnd(m)
  }
  draughtsMove(m, seat, move) {
    const R = VARIANTS.international
    const path = (move?.path || []).map((q) => (seat === 0 ? q : R.n * R.n - 1 - q))
    const side = seat === 0 ? 'p' : 'o'
    const turn = turnsFor(m.live.board, side, R).find((tt) => tt.path.length === path.length && tt.path.every((q, i) => q === path[i]))
    if (!turn) return false
    const moved = turn.board[turn.path[turn.path.length - 1]]
    m.live.kingPlies = turn.caps.length || !moved.king ? 0 : m.live.kingPlies + 1
    m.live.board = turn.board
    m.live.plies++
    m.live.turn = 1 - seat
    return true
  }
  ayoMove(m, seat, move) {
    const cup = seat === 0 ? move?.cup : (move?.cup + 6) % 12
    const side = seat === 0 ? 'p' : 'o'
    if (!ayoLegal(m.live.board, side).includes(cup)) return false
    const res = ayoPlay(m.live.board, cup, side)
    m.live.board = res.board
    m.live.store[seat] += res.taken
    m.live.moves++
    m.live.turn = 1 - seat
    return true
  }
  checkLiveEnd(m) {
    const L = m.live
    if (m.game === 'draughts') {
      const side = L.turn === 0 ? 'p' : 'o'
      if (!turnsFor(L.board, side, VARIANTS.international).length) return this.finish(m, m.players[1 - L.turn].id, 'no moves left')
      if (L.kingPlies >= VARIANTS.international.kingDraw || L.plies >= 400) return this.finish(m, null, 'a draw')
    } else {
      if (L.store[0] > 24) return this.finish(m, m.players[0].id, 'more than 24 seeds')
      if (L.store[1] > 24) return this.finish(m, m.players[1].id, 'more than 24 seeds')
      const side = L.turn === 0 ? 'p' : 'o'
      if (!ayoLegal(L.board, side).length || L.moves > 200) {
        // nobody can play: everyone keeps the seeds on their own side
        const own = (k) => L.board.reduce((a, n, i) => a + ((k === 0 ? i < 6 : i >= 6) ? n : 0), 0)
        const a = L.store[0] + own(0)
        const b = L.store[1] + own(1)
        return this.finish(m, a > b ? m.players[0].id : b > a ? m.players[1].id : null, 'the seeds are counted')
      }
    }
  }
  forfeit(cid, { id }) {
    const m = this.matches.get(id)
    const p = this.profile(cid)
    if (!m || m.over) return
    const seat = m.players.findIndex((pl) => pl.id === p.id)
    if (seat < 0) return
    if (m.kind === 'duel') return this.duelResult(cid, { id, score: 0 })
    this.finish(m, m.players[1 - seat].id, `${p.name} gave up`)
  }

  // ---------------------------------------------------------------- score duels
  duelResult(cid, { id, score }) {
    const m = this.matches.get(id)
    const p = this.profile(cid)
    if (!m || m.over || m.kind !== 'duel') return
    const seat = m.players.findIndex((pl) => pl.id === p.id)
    if (seat < 0 || m.scores[seat] != null) return
    m.scores[seat] = Math.max(0, Math.min(1e6, Math.round(num(score))))
    this.progress(p, { event: 'solo', game: m.game, score: m.scores[seat] })
    const ocid = this.clientOf(m.players[1 - seat].id)
    if (ocid) this.toast(ocid, `${p.name} finished ${DUEL_GAMES[m.game].name}: ${m.scores[seat]} points. Your turn to beat it!`)
    if (m.scores.every((x) => x != null)) this.settleDuel(m)
  }
  settleDuel(m) {
    if (m.over) return
    const [a, b] = m.scores.map((x) => x ?? 0)
    this.finish(m, a > b ? m.players[0].id : b > a ? m.players[1].id : null, `${a} – ${b}`)
  }

  /** The end of a match: the pot to the winner (stakes back on a draw), then the bets. */
  finish(m, winnerId, why) {
    if (m.over) return
    m.over = true
    clearTimeout(m.timer)
    clearTimeout(m.awayTimer)
    const payouts = {}
    for (const pl of m.players) {
      const pr = this.playerById(pl.id)
      if (!pr) continue
      pr.stats.played++
      this.progress(pr, { event: 'play', game: m.game })
      if (winnerId == null) {
        pr.money += m.stake
        payouts[pl.id] = m.stake
      } else if (pl.id === winnerId) {
        const bonus = groupWinBonus(pr.group, m.game) + (pr.items.luckyCap ? SHOP.luckyCap.effect.win : 0)
        const won = m.stake * 2 + Math.round(m.stake * bonus)
        pr.money += won
        pr.stats.wins++
        payouts[pl.id] = won
        this.progress(pr, { event: 'win', game: m.game })
      } else pr.stats.losses++
    }
    // the bets: everyone who backed the winner shares the whole pool, in proportion
    const seat = m.players.findIndex((pl) => pl.id === winnerId)
    const pool = m.bets.reduce((x, bt) => x + bt.amount, 0)
    const backing = m.bets.filter((bt) => bt.on === seat).reduce((x, bt) => x + bt.amount, 0)
    for (const bt of m.bets) {
      const pr = this.playerById(bt.by)
      if (!pr) continue
      if (seat < 0 || !backing) {
        pr.money += bt.amount // a draw, or nobody backed the winner: money back
        continue
      }
      if (bt.on === seat) {
        const share = Math.floor((pool * bt.amount) / backing)
        const won = share + Math.round((share - bt.amount) * (GROUPS[pr.group]?.perk?.bets || 0))
        pr.money += won
        pr.stats.betsWon++
        this.progress(pr, { event: 'betWin' })
        payouts[bt.by] = (payouts[bt.by] || 0) + won
      } else if (pr.items.insurance > 0) {
        pr.items.insurance--
        pr.money += Math.floor(bt.amount / 2)
        payouts[bt.by] = (payouts[bt.by] || 0) + Math.floor(bt.amount / 2)
      }
    }
    this.save()
    const winnerName = m.players.find((pl) => pl.id === winnerId)?.name || null
    const end = { t: 'matchEnd', id: m.id, game: m.game, gameName: DUEL_GAMES[m.game].name, winner: winnerId, winnerName, why, scores: m.scores, payouts, players: m.players }
    const told = new Set()
    for (const id of [...m.players.map((pl) => pl.id), ...m.bets.map((bt) => bt.by)]) {
      const x = this.clientOf(id)
      if (x && !told.has(x)) {
        told.add(x)
        this.send(x, end)
        this.pushMe(x)
      }
    }
    this.toRoom(m.map, { t: 'matches', matches: this.openMatches(m.map) })
    this.toRoom(m.map, { t: 'chat', id: 'news', name: 'Baba Radio', text: winnerName ? `${winnerName} wins the ${DUEL_GAMES[m.game].name} (${why}).` : `The ${DUEL_GAMES[m.game].name} ends in a draw.`, at: this.now() })
    setTimeout(() => this.matches.delete(m.id), 60000)?.unref?.()
  }
  playerById(id) {
    for (const p of Object.values(this.store.players)) if (p.id === id) return p
    return null
  }

  // ---------------------------------------------------------------- bets
  bet(cid, { id, on, amount }) {
    const m = this.matches.get(id)
    const p = this.profile(cid)
    if (!m || m.over) return this.err(cid, 'Betting is closed.')
    if (m.players.some((pl) => pl.id === p.id)) return this.err(cid, "You can't bet on your own match.")
    const a = Math.round(num(amount) / 100) * 100
    if (![0, 1].includes(on) || a < 100 || a > MAX_STAKE) return this.err(cid, 'Bet ₦100 to ₦50,000 on one of the two.')
    if (a > p.money) return this.err(cid, "You don't have that much.")
    p.money -= a
    m.bets.push({ by: p.id, on, amount: a })
    this.progress(p, { event: 'bet' })
    this.save()
    this.pushMe(cid)
    this.toast(cid, `₦${a.toLocaleString('en-NG')} on ${m.players[on].name}.`)
    this.toRoom(m.map, { t: 'matches', matches: this.openMatches(m.map) })
  }

  // ---------------------------------------------------------------- solo games, groups, quests, shop
  soloResult(cid, { game, score }) {
    const p = this.profile(cid)
    if (!DUEL_GAMES[game]) return
    this.progress(p, { event: 'solo', game, score: num(score) })
    this.save()
    this.pushMe(cid)
  }
  joinGroup(cid, { group }) {
    const p = this.profile(cid)
    if (!GROUPS[group]) return this.err(cid, 'No such group.')
    p.group = group
    this.save()
    this.pushMe(cid)
    this.toast(cid, `Welcome to ${GROUPS[group].name}. ${GROUPS[group].perkText}.`)
    const c = this.clients.get(cid)
    if (c.map) this.toRoom(c.map, { t: 'joined', player: this.publicOf(p, c) }, cid)
  }
  leaveGroup(cid) {
    const p = this.profile(cid)
    p.group = null
    this.save()
    this.pushMe(cid)
  }
  claimQuest(cid, { id }) {
    const p = this.profile(cid)
    this.resetDaily(p)
    const q = QUESTS.find((x) => x.id === id)
    if (!q) return
    if (p.quests.claimed[id]) return this.err(cid, 'Already claimed today.')
    if ((p.quests.progress[id] || 0) < q.goal.count) return this.err(cid, 'Not done yet.')
    const pay = Math.round(q.reward * (1 + (GROUPS[p.group]?.perk?.quests || 0)))
    p.money += pay
    p.quests.claimed[id] = true
    this.save()
    this.pushMe(cid)
    this.toast(cid, `Quest done: +₦${pay.toLocaleString('en-NG')}`)
  }
  buy(cid, { item }) {
    const p = this.profile(cid)
    const it = SHOP[item]
    if (!it) return this.err(cid, 'No such thing.')
    if (it.kind !== 'uses' && p.items[item]) return this.err(cid, 'You have it already.')
    const price = Math.round(it.price * (1 - (GROUPS[p.group]?.perk?.shop || 0)))
    if (price > p.money) return this.err(cid, "You don't have that much.")
    p.money -= price
    p.items[item] = it.kind === 'uses' ? (p.items[item] || 0) + it.uses : true
    if (it.kind === 'look') {
      p.lookExtra = { ...(p.lookExtra || {}), ...it.look }
      p.look = { ...p.look, ...it.look }
    }
    this.progress(p, { event: 'shop' })
    this.save()
    this.pushMe(cid)
    this.toast(cid, `Bought: ${it.name}.`)
  }
  useToken(cid) {
    const p = this.profile(cid)
    if (!(p.items.powerToken > 0)) return this.send(cid, { t: 'token', ok: false })
    p.items.powerToken--
    this.save()
    this.pushMe(cid)
    this.send(cid, { t: 'token', ok: true })
  }
  leaders(cid) {
    const all = Object.values(this.store.players)
    const top = (key, f) =>
      all
        .map((p) => ({ name: p.name, group: p.group, value: f(p) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    const groups = Object.keys(GROUPS)
      .map((g) => ({ group: g, name: GROUPS[g].name, value: all.filter((p) => p.group === g).reduce((a, p) => a + p.stats.wins, 0), members: all.filter((p) => p.group === g).length }))
      .sort((a, b) => b.value - a.value)
    this.send(cid, { t: 'leaders', richest: top('money', (p) => p.money), winners: top('wins', (p) => p.stats.wins), groups })
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
function clean2(look) {
  const out = {}
  for (const [k, v] of Object.entries(look).slice(0, 20)) if (/^#[0-9a-f]{6}$/i.test(v) || (typeof v === 'string' && v.length < 24)) out[clean(k, 16)] = v
  if (Array.isArray(look.accessories)) out.accessories = look.accessories.slice(0, 4)
  return out
}

/** A move from one player's point of view, as the other player sees it. */
export function flipMove(game, move) {
  if (game === 'draughts') return { path: (move.path || []).map((q) => 99 - q) }
  if (game === 'ayo') return { cup: (move.cup + 6) % 12 }
  return move
}
