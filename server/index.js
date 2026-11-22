// Lagos Online server: one WebSocket per player, JSON messages in and out,
// the rules in world.js.
//   PORT (8787) · DATA_FILE (server/data/players.json) · ALLOWED_ORIGINS (comma list; empty = any)
//   node server/index.js
import http from 'http'
import { WebSocketServer } from 'ws'
import { World } from './world.js'
import { fileStore } from './store.js'

const PORT = Number(process.env.PORT) || 8787
const DATA_FILE = process.env.DATA_FILE || new URL('./data/players.json', import.meta.url).pathname
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)

const store = fileStore(DATA_FILE)
const sockets = new Map()
const send = (cid, msg) => {
  const ws = sockets.get(cid)
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg))
}
const world = new World({ store, send })

const server = http.createServer((req, res) => {
  // a health check for the host (and a friendly page)
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end(`Lagos Online is up. ${sockets.size} connected.\n`)
})
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 })
let next = 1
wss.on('connection', (ws, req) => {
  if (ORIGINS.length && !ORIGINS.includes(req.headers.origin)) return ws.close(1008, 'origin not allowed')
  const cid = next++
  sockets.set(cid, ws)
  world.connect(cid)
  let count = 0
  const budget = setInterval(() => (count = 0), 1000)
  ws.on('message', (data) => {
    if (++count > 60) return // too chatty: drop the rest of this second
    let msg
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }
    try {
      world.handle(cid, msg)
    } catch (err) {
      console.error('handle', msg?.t, err)
    }
  })
  ws.on('close', () => {
    clearInterval(budget)
    sockets.delete(cid)
    world.disconnect(cid)
  })
  // keep idle phone connections alive through proxies
  ws.isAlive = true
  ws.on('pong', () => (ws.isAlive = true))
})
const ping = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) ws.terminate()
    ws.isAlive = false
    ws.ping()
  }
}, 30000)

server.listen(PORT, () => console.log(`Lagos Online listening on :${PORT}`))
const stop = () => {
  clearInterval(ping)
  store.flush()
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
