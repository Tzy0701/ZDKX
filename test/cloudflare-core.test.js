// 不依赖 Node 文件存储的规则服务：模拟 Durable Object 唤醒、闹钟和存档。
const assert = require('assert');
const core = require('../server/official-core');
const BB = require('../js/engine');
let sequence = 0;
function runtime(records, clients) {
  const jobs = new Map();
  const service = core({ clients }, {
    restart: false,
    token: () => (++sequence).toString(16).padEnd(48, '0'),
    store: { names: () => [...records.keys()], read: name => records.get(name), write: (name, data) => records.set(name, data) },
    setTimeout(fn, delay) { const id = ++sequence; jobs.set(id, { fn, delay }); return id; },
    clearTimeout: id => jobs.delete(id)
  });
  return { service, jobs };
}
function peer(name) { return { room: name, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; }
function last(ws, topic) { return ws.messages.filter(m => m.topic === topic).at(-1)?.data; }

for (let n = 2; n <= 5; n++) {
  const name = 'bb-cloud-core-' + n, records = new Map(), clients = new Set();
  let { service } = runtime(records, clients);
  const peers = Array.from({ length: n }, () => peer(name));
  peers.forEach((ws, i) => {
    clients.add(ws);
    service.handle(ws, i ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 1, name: '玩家' + i });
  });
  const credentials = peers.map(ws => last(ws, 'official:welcome').credential);
  service.handle(peers[0], 'official:start', { mid: 1, revision: 0, commandId: 'start' });
  let room = service.load(name), G = room.G;
  for (let pi = 0; pi < n; pi++) {
    const w = G.wires.find(w => w.o === pi && Number.isInteger(w.v));
    service.handle(peers[pi], 'official:act', { gid: G.gid, revision: room.revision, commandId: 'info-' + pi, action: { a: 'info', w: w.id } });
  }
  assert.equal(G.phase, 'play');
  let pair;
  for (const own of G.wires.filter(w => !w.cut && w.o === 0)) {
    const target = G.wires.find(w => !w.cut && w.o !== 0 && w.v === own.v);
    if (target) { pair = { own, target }; break; }
  }
  assert(pair);
  service.handle(peers[0], 'official:act', { gid: G.gid, revision: room.revision, commandId: 'cut', action: { a: 'dual', w: pair.target.id, val: pair.own.v } });
  assert.equal(G.pending.step, 'target');
  const id = G.pending.id, revision = room.revision;
  // 重建服务模拟休眠唤醒，连接附件携带凭证，未完成决定不丢失。
  service = runtime(records, clients).service;
  room = service.load(name); G = room.G;
  assert.equal(G.pending.id, id);
  assert.equal(room.revision, revision);
  service.handle(peers[pair.target.o], 'official:act', { gid: G.gid, revision, commandId: 'answer', action: { a: 'resolve', id, w: pair.target.id } });
  assert.equal(G.pending.step, 'own');
  assert(last(peers[0], 'official:view').view.pending.choices);
  assert(!last(peers[pair.target.o], 'official:view').view.pending.choices);
  service = runtime(records, clients).service;
  room = service.load(name); G = room.G;
  const before = JSON.stringify(G);
  service.handle(peers[pair.target.o], 'official:act', { gid: G.gid, revision, commandId: 'stale', action: { a: 'resolve', id, w: pair.target.id } });
  assert.equal(JSON.stringify(G), before);
  const request = { gid: G.gid, revision: room.revision, commandId: 'own', action: { a: 'resolve', id, w: pair.own.id } };
  service.handle(peers[0], 'official:act', request);
  const completed = JSON.stringify(G);
  service.handle(peers[0], 'official:act', request);
  assert.equal(JSON.stringify(G), completed);
  assert(!G.pending);
  // 新连接用服务器发出的凭证恢复同一席位。
  const reconnect = peer(name); clients.add(reconnect);
  service.handle(reconnect, 'hello', { credential: credentials[0], name: '恢复' });
  assert.equal(last(reconnect, 'official:welcome').pid, G.players[0].pid);
  const spy = peer(name); clients.add(spy);
  service.handle(spy, 'hello', { pid: G.players[0].pid, name: '冒用' });
  assert(!spy.officialCredential);
  assert(last(spy, 'official:error'));
  // 闹钟唤醒时执行真实超时，客户端 timeout 仍被拒绝。
  G.phase = 'play'; G.deadline = Date.now() - 1;
  G.mission.rules.timer = 60;
  const oldDet = G.det;
  service.handle(reconnect, 'official:act', { gid: G.gid, revision: room.revision, commandId: 'fake-timeout', action: { a: 'timeout' } });
  assert.equal(G.det, oldDet);
  assert(service.nextWake() <= Date.now());
  service.tick();
  assert(G.det > oldDet || G.phase === 'lost');
  assert.equal(BB.view(G, 0).gid, G.gid);
}
console.log('✓ 云端核心 2–5 人：私有选择、两阶段唤醒恢复、旧命令／冒用／客户端超时拒绝、服务器闹钟');
