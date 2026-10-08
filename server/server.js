/* 炸弹克星 · 自建联机服务器
 * 新任务集牌局由本机管理；旧自定义房间沿用 WebSocket 中继。
 * 用法：npm install && npm start  →  打开 http://localhost:8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const officialService = require('./official');
const audioFileService = require('./audio-files');
let audioFiles;

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };

// index.html 按 Artifact 规范只写了正文，这里补上文档骨架
function wrapPage(body) {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="bb-server" content="1">' +
    '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' +
    '</head><body>' + body + '</body></html>';
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); }
  catch (_) { res.writeHead(400); return res.end('bad request'); }
  if (p === '/healthz') {
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if(p.startsWith('/audio/')){audioFiles.handle(req,res,p);return;}
  if (p === '/' || p === '/index.html') {
    fs.readFile(path.join(ROOT, 'index.html'), 'utf8', (err, txt) => {
      if (err) { res.writeHead(500); return res.end('index.html missing'); }
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
      res.end(wrapPage(txt));
    });
    return;
  }
  const file = path.normalize(path.join(ROOT, p));
  const allowed = file.startsWith(path.join(ROOT, 'js') + path.sep) || file === path.join(ROOT, 'RULES.md');
  if (!allowed) { res.writeHead(404); return res.end('not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const official = officialService(wss, process.env.BB_DATA_DIR);
audioFiles = audioFileService({dir:path.join(process.env.BB_DATA_DIR || path.join(__dirname,'.official-data'),'audio-cache'),resolve:hash=>official.audioAsset(hash)});
const rooms = new Map(); // name -> Set<ws>
const customRooms = new Set();
let nextId = 1;

function peersOf(name) { return [...(rooms.get(name) || [])].map((c) => c.peer); }
function broadcast(name, obj) {
  const s = JSON.stringify(obj);
  for (const c of rooms.get(name) || []) if (c.readyState === 1) c.send(s);
}

wss.on('connection', (ws) => {
  ws.peer = 'p' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
  ws.room = null;
  ws.pid = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (m.t === 'join' && typeof m.room === 'string' && /^[a-z0-9][a-z0-9_.-]{0,47}$/.test(m.room)) {
      if (ws.room) { official.disconnect(ws); leave(ws); }
      ws.room = m.room;
      if (!rooms.has(m.room)) rooms.set(m.room, new Set());
      rooms.get(m.room).add(ws);
      ws.send(JSON.stringify({ t: 'welcome', me: ws.peer }));
      broadcast(m.room, { t: 'peers', peers: peersOf(m.room) });
    } else if (m.t === 'emit' && ws.room && typeof m.topic === 'string') {
      if (m.topic.startsWith('official:') && customRooms.has(ws.room)) return;
      if (official.handle(ws, m.topic, m.data)) return;
      if (m.topic.startsWith('official:')) return;
      if (m.topic === 'lobby' || m.topic === 'pub') customRooms.add(ws.room);
      if (m.topic === 'hello' && m.data && typeof m.data.pid === 'string') ws.pid = m.data.pid;
      const packet = { t: 'msg', topic: m.topic, data: m.data, peer: ws.peer };
      if ((m.topic === 'hand' || m.topic === 'err') && m.data && typeof m.data.to === 'string') {
        const payload = JSON.stringify(packet);
        for (const client of rooms.get(ws.room) || []) {
          if (client.pid === m.data.to && client.readyState === 1) client.send(payload);
        }
      } else broadcast(ws.room, packet);
    }
  });
  ws.on('close', () => { official.disconnect(ws); leave(ws); });
  ws.on('error', () => leave(ws));
});

function leave(ws) {
  const set = rooms.get(ws.room);
  if (!set) return;
  set.delete(ws);
  if (!set.size) { rooms.delete(ws.room); customRooms.delete(ws.room); }
  else broadcast(ws.room, { t: 'peers', peers: peersOf(ws.room) });
  ws.room = null;
  ws.pid = null;
  ws.officialCredential = null;
}

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

server.listen(PORT, HOST, () => console.log('炸弹克星服务器已启动：http://localhost:' + server.address().port));
