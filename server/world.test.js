import { describe, it, expect, beforeEach } from 'vitest'
import { World, flipMove } from './world.js'
import { memoryStore } from './store.js'
import { START_MONEY, DAILY_BONUS, GROUPS, SHOP, PROPERTIES, FURNITURE_SHOP } from '../src/game/online/catalog.js'
import { turnsFor, VARIANTS, initialBoard } from '../src/game/modes/arcade/games/draughts.js'

// a little harness: clients with inboxes
function setup() {
  const inbox = new Map()
  const world = new World({ store: memoryStore(), send: (cid, msg) => inbox.get(cid)?.push(msg), now: () => Date.UTC(2026, 10, 22, 12), random: () => 0.5 })
  let n = 0
  const join = (name, map = 'lagos') => {
    const cid = ++n
    inbox.set(cid, [])
    world.connect(cid)
    world.handle(cid, { t: 'hello', token: `token-${name}-0123456789`, name, look: { shirt: '#ff0000' } })
    world.handle(cid, { t: 'join', map, x: 0, z: 0 })
    const last = (type) => [...inbox.get(cid)].reverse().find((m) => m.t === type)
    const me = () => last('me').me
    return { cid, name, last, me, all: (type) => inbox.get(cid).filter((m) => m.t === type), send: (msg) => world.handle(cid, msg) }
  }
  return { world, join }
}

describe('Lagos Online: the world', () => {
  let W
  beforeEach(() => (W = setup()))

  it('a new guest gets money and the daily bonus; players see each other, move and chat in their room', () => {
    const a = W.join('Ada')
    expect(a.me().money).toBe(START_MONEY + DAILY_BONUS)
    const b = W.join('Bayo')
    expect(b.last('room').players.map((p) => p.name)).toEqual(['Ada'])
    expect(a.last('joined').player.name).toBe('Bayo')
    b.send({ t: 'move', x: 3, z: 4, ry: 1, anim: 'walk' })
    expect(a.last('moved')).toMatchObject({ x: 3, z: 4, anim: 'walk' })
    b.send({ t: 'say', text: 'How far?' })
    expect(a.last('chat').text).toBe('How far?')
    // someone in another place doesn't hear it
    const c = W.join('Chi', 'village')
    expect(c.all('chat')).toHaveLength(0)
  })

  it('a challenge with a stake: both stakes held, the winner takes the pot, Baba Radio announces it', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'challenge', to: b.me().id, game: 'akara', stake: 1000 })
    const inv = b.last('invite')
    expect(inv.gameName).toBe('Akara Fry')
    b.send({ t: 'respond', id: inv.id, accept: true })
    const m = a.last('match').match
    expect(m.seed).toBe(b.last('match').match.seed) // the same level for both
    expect(a.me().money).toBe(START_MONEY + DAILY_BONUS - 1000)
    a.send({ t: 'duelResult', id: m.id, score: 50 })
    b.send({ t: 'duelResult', id: m.id, score: 30 })
    expect(a.last('matchEnd').winnerName).toBe('Ada')
    expect(a.me().money).toBe(START_MONEY + DAILY_BONUS + 1000)
    expect(b.me().money).toBe(START_MONEY + DAILY_BONUS - 1000)
    expect(b.last('chat').name).toBe('Baba Radio')
  })

  it("you can't stake money you don't have", () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'challenge', to: b.me().id, game: 'akara', stake: 999999 })
    expect(a.last('error')).toBeTruthy()
    expect(b.all('invite')).toHaveLength(0)
  })

  it('live draughts: the server checks moves, relays them flipped, and refuses illegal ones', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'challenge', to: b.me().id, game: 'draughts', stake: 0 })
    b.send({ t: 'respond', id: b.last('invite').id, accept: true })
    const m = a.last('match').match
    expect(a.last('match').match.seat).toBe(0)
    expect(b.last('match').match.seat).toBe(1)
    // Bayo can't go first
    const bt = turnsFor(initialBoard(VARIANTS.international), 'p', VARIANTS.international)[0]
    b.send({ t: 'liveMove', id: m.id, move: { path: bt.path } })
    expect(b.last('error').text).toMatch(/turn/)
    // Ada plays a legal move; Bayo receives it from his side of the board
    const t0 = turnsFor(initialBoard(VARIANTS.international), 'p', VARIANTS.international)[0]
    a.send({ t: 'liveMove', id: m.id, move: { path: t0.path } })
    expect(b.last('liveMove').move.path).toEqual(t0.path.map((q) => 99 - q))
    // an illegal move from Bayo (a piece that isn't there)
    b.send({ t: 'liveMove', id: m.id, move: { path: [0, 11] } })
    expect(b.last('error').text).toMatch(/not allowed/)
    // giving up ends it
    b.send({ t: 'forfeit', id: m.id })
    expect(a.last('matchEnd').winnerName).toBe('Ada')
  })

  it('live Ayò: moves are mirrored for the other player', () => {
    expect(flipMove('ayo', { cup: 2 })).toEqual({ cup: 8 })
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'challenge', to: b.me().id, game: 'ayo' })
    b.send({ t: 'respond', id: b.last('invite').id, accept: true })
    const m = a.last('match').match
    a.send({ t: 'liveMove', id: m.id, move: { cup: 0 } })
    expect(b.last('liveMove').move.cup).toBe(6)
    b.send({ t: 'liveMove', id: m.id, move: { cup: 3 } })
    expect(a.last('liveMove').move.cup).toBe(9)
  })

  it('bets: everyone who backed the winner shares the pool; a group perk adds to bet winnings', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    const c = W.join('Chi')
    const d = W.join('Dan')
    d.send({ t: 'joinGroup', group: 'sugar' })
    a.send({ t: 'challenge', to: b.me().id, game: 'penalty', stake: 0 })
    b.send({ t: 'respond', id: b.last('invite').id, accept: true })
    const m = a.last('match').match
    expect(c.last('matches').matches.map((x) => x.id)).toContain(m.id)
    const start = c.me().money
    c.send({ t: 'bet', id: m.id, on: 1, amount: 2000 }) // on Bayo
    d.send({ t: 'bet', id: m.id, on: 0, amount: 1000 }) // on Ada
    a.send({ t: 'bet', id: m.id, on: 0, amount: 1000 })
    expect(a.last('error').text).toMatch(/own match/)
    a.send({ t: 'duelResult', id: m.id, score: 80 })
    b.send({ t: 'duelResult', id: m.id, score: 20 })
    expect(c.me().money).toBe(start - 2000)
    // Dan takes the whole ₦3,000 pool, plus 15% of his ₦2,000 profit
    expect(d.last('matchEnd').payouts[d.me().id]).toBe(3000 + Math.round(2000 * GROUPS.sugar.perk.bets))
  })

  it('quests count what you do and pay once a day; groups and shop items change the money', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'claimQuest', id: 'profDraughts' })
    expect(a.last('error').text).toMatch(/Not done/)
    a.send({ t: 'soloResult', game: 'runner', score: 700 })
    const before = a.me().money
    a.send({ t: 'claimQuest', id: 'adaRunner' })
    expect(a.me().money).toBe(before + 1200)
    a.send({ t: 'claimQuest', id: 'adaRunner' })
    expect(a.last('error').text).toMatch(/Already/)
    // the shop, with the campaign team's discount
    b.send({ t: 'joinGroup', group: 'campaign' })
    const m0 = b.me().money
    b.send({ t: 'buy', item: 'jersey' })
    expect(b.me().money).toBe(m0 - Math.round(SHOP.jersey.price * 0.85))
    expect(b.me().look.shirt).toBe(SHOP.jersey.look.shirt)
    b.send({ t: 'buy', item: 'jersey' })
    expect(b.last('error').text).toMatch(/already/)
    // leaders
    a.send({ t: 'leaders' })
    expect(a.last('leaders').richest.length).toBe(2)
  })

  it('a player who comes back with the same token is the same player', () => {
    const a = W.join('Ada')
    const id = a.me().id
    W.world.disconnect(a.cid)
    const again = W.join('Ada')
    expect(again.me().id).toBe(id)
    expect(again.me().money).toBe(START_MONEY + DAILY_BONUS) // no second daily bonus today
  })
})

describe('Lagos Online: rooms, sending money, the live board', () => {
  let W
  beforeEach(() => (W = setup()))
  const code = (pl) => pl.last('lobby')?.code

  it('a 4-letter room: friends join with the code, see only each other, and chat only there', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    const c = W.join('Chi') // stays in the public world
    a.send({ t: 'createRoom' })
    const k = code(a)
    expect(k).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(c.last('left').id).toBe(a.me().id) // Ada left the public street
    b.send({ t: 'joinRoom', code: k.toLowerCase() })
    expect(code(b)).toBe(k)
    expect(b.last('room').players.map((p) => p.name)).toEqual(['Ada'])
    expect(b.last('lobby').members.map((m) => m.name).sort()).toEqual(['Ada', 'Bayo'])
    b.send({ t: 'say', text: 'Our room!' })
    expect(a.last('chat').text).toBe('Our room!')
    expect(c.all('chat').filter((m) => m.text === 'Our room!')).toHaveLength(0)
    // challenges don't cross rooms
    c.send({ t: 'challenge', to: a.me().id, game: 'akara', stake: 0 })
    expect(c.last('error').text).toMatch(/not around/)
    // back to the public world
    b.send({ t: 'leaveRoom' })
    expect(b.last('lobby').code).toBe(null)
    expect(b.last('room').players.map((p) => p.name)).toEqual(['Chi'])
  })

  it('a wrong code says so', () => {
    const a = W.join('Ada')
    a.send({ t: 'joinRoom', code: 'ZZZZ' })
    expect(a.last('error').text).toMatch(/No room/)
    expect(a.last('lobby').missing).toBe('ZZZZ')
  })

  it('sending naira: to someone in your room, within the limits', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    const start = a.me().money
    a.send({ t: 'give', to: b.me().id, amount: 2500 })
    expect(a.me().money).toBe(start - 2500)
    expect(b.me().money).toBe(start + 2500)
    expect(b.last('toast').text).toMatch(/Ada sent you ₦2,500/)
    expect(a.me().stats.given).toBe(2500)
    a.send({ t: 'give', to: b.me().id, amount: 40 })
    expect(a.last('error').text).toMatch(/at a time/)
    a.send({ t: 'give', to: b.me().id, amount: 999999 })
    expect(a.last('error').text).toMatch(/at a time/)
    a.send({ t: 'give', to: a.me().id, amount: 500 })
    expect(a.last('error').text).toMatch(/not in your room/)
    // someone in another room can't be paid
    b.send({ t: 'createRoom' })
    a.send({ t: 'give', to: b.me().id, amount: 500 })
    expect(a.last('error').text).toMatch(/not in your room/)
  })

  it('the live board: everyone in the room with net worth, respect, influence and heists; it updates', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'createRoom' })
    b.send({ t: 'joinRoom', code: code(a) })
    W.world.flushBoards()
    const rows = a.last('board').rows
    expect(rows.map((r) => r.name).sort()).toEqual(['Ada', 'Bayo'])
    expect(rows[0]).toMatchObject({ worth: expect.any(Number), respect: 0, influence: 0, heists: 0 })
    // a duel won: respect; a Back Gate night won: a heist
    a.send({ t: 'challenge', to: b.me().id, game: 'akara', stake: 1000 })
    b.send({ t: 'respond', id: b.last('invite').id, accept: true })
    const m = a.last('match').match
    a.send({ t: 'duelResult', id: m.id, score: 50 })
    b.send({ t: 'duelResult', id: m.id, score: 10 })
    a.send({ t: 'soloResult', game: 'sneak', score: 250 })
    W.world.flushBoards()
    const ada = b.last('board').rows.find((r) => r.name === 'Ada')
    expect(ada.respect).toBeGreaterThan(10)
    expect(ada.heists).toBe(1)
    expect(b.last('board').rows[0].name).toBe('Ada') // richest first
  })
})

describe('Lagos Online: property', () => {
  let W
  beforeEach(() => (W = setup()))
  const fund = (name, money) => (W.world.store.players[`token-${name}-0123456789`].money = money)

  it('prices start at ₦100,000 and grow with the floor area', () => {
    const list = Object.values(PROPERTIES).sort((x, y) => x.size - y.size)
    expect(list[0].price).toBeGreaterThanOrEqual(100000)
    for (let i = 1; i < list.length; i++) expect(list[i].price).toBeGreaterThan(list[i - 1].price)
  })

  it('buy a place, furnish it, take a piece back, and a friend in the room can visit', () => {
    const a = W.join('Ada')
    const b = W.join('Bayo')
    a.send({ t: 'buyProperty', id: 'hostelRoom' })
    expect(a.last('error').text).toMatch(/don't have/) // property starts at ₦100,000: not for a new guest
    fund('Ada', 2000000)
    a.send({ t: 'buyProperty', id: 'duplex' })
    expect(a.me().money).toBe(2000000 - PROPERTIES.duplex.price)
    expect(a.me().properties.duplex.furniture).toEqual([])
    a.send({ t: 'buyProperty', id: 'duplex' })
    expect(a.last('error').text).toMatch(/already/)
    // furnish: a sofa (paid), placed where she stands
    a.send({ t: 'furnish', id: 'duplex', model: 'sofa', x: 1.234, z: -2, rot: 90 })
    expect(a.me().properties.duplex.furniture).toEqual([{ model: 'sofa', x: 1.23, z: -2, rot: 90 }])
    expect(a.me().money).toBe(2000000 - PROPERTIES.duplex.price - FURNITURE_SHOP.sofa)
    a.send({ t: 'furnish', id: 'duplex', model: 'goldThrone', x: 0, z: 0 })
    expect(a.last('error').text).toMatch(/No such/)
    a.send({ t: 'furnish', id: 'hostelRoom', model: 'sofa', x: 0, z: 0 })
    expect(a.last('error').text).toMatch(/isn't yours/)
    // what she owns counts on the board
    W.world.flushBoards()
    const row = a.last('board').rows.find((r) => r.name === 'Ada')
    expect(row.worth).toBe(a.me().money + PROPERTIES.duplex.price + FURNITURE_SHOP.sofa)
    // Bayo sees she has a place and visits
    expect(b.last('joined')?.player?.places || b.last('room').players.find((p) => p.name === 'Ada')?.places).toBeTruthy()
    b.send({ t: 'visit', owner: a.me().id, id: 'duplex' })
    expect(b.last('place')).toMatchObject({ ownerName: 'Ada', id: 'duplex', furniture: [{ model: 'sofa' }] })
    expect(a.last('toast').text).toMatch(/Bayo is visiting/)
    // half back for a piece taken out
    const m = a.me().money
    a.send({ t: 'unfurnish', id: 'duplex', index: 0 })
    expect(a.me().money).toBe(m + FURNITURE_SHOP.sofa / 2)
    expect(a.me().properties.duplex.furniture).toEqual([])
  })
})
