// 运行实际 Durable Object 类，模拟休眠时保留的 WebSocket 附件与存储。
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const { webcrypto } = require('crypto');
const core = require('../server/official-core');
class Socket {
  constructor() { this.readyState = 1; this.messages = []; this.data = null; }
  serializeAttachment(data) { this.data = structuredClone(data); }
  deserializeAttachment() { return structuredClone(this.data); }
  send(raw) { this.messages.push(JSON.parse(raw)); }
  close() { this.readyState = 3; }
}
let now = Date.now();
class Clock extends Date { static now() { return now; } }
const source = fs.readFileSync(require.resolve('../cloudflare/worker/src/index.js'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default { fetch: route };', '')
  .replace('export class GameRoom', 'class GameRoom') + '\nglobalThis.GameRoom = GameRoom;';
const sandbox = { officialCore: core, DurableObject: class {}, Date: Clock, crypto: webcrypto, TextEncoder,
  Request, URL, Uint8Array, console, structuredClone,
  roomName: url => url.searchParams.get('room'),
  Response: class { constructor(body, options) { Object.assign(this, options); this.body = body; } },
  WebSocketPair: class { constructor() { this[0] = new Socket(); this[1] = new Socket(); } }
};
vm.runInNewContext(source, sandbox);
function context() {
  const values = new Map(), sockets = new Set(); let alarm = null;
  return { values, sockets, getWebSockets: () => [...sockets].filter(ws => ws.readyState === 1),
    acceptWebSocket: ws => sockets.add(ws), blockConcurrencyWhile: fn => Promise.resolve().then(fn),
    storage: {
      get: async key => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)),
      getAlarm: async () => alarm, setAlarm: async when => { alarm = when; }, deleteAlarm: async () => { alarm = null; },
      transaction: async fn => fn(),
      deleteAll: async () => { values.clear(); alarm = null; }
    }
  };
}
const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
async function send(room, ws, topic, data) { await room.webSocketMessage(ws, JSON.stringify({ t: 'emit', topic, data })); }
async function main() {
  const ctx = context(), name = 'bb-hibernate'; let room = new sandbox.GameRoom(ctx, {}); await room.ready;
  const peers = [];
  for (let i = 0; i < 3; i++) {
    await room.fetch(new Request('https://game.pages.dev/ws?room=' + name));
    const ws = [...ctx.sockets].at(-1); peers.push(ws);
    await room.webSocketMessage(ws, JSON.stringify({ t: 'join', room: name }));
    await send(room, ws, i ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 1, name: '玩家' + i });
  }
  await send(room, peers[0], 'official:start', { mid: 1, revision: 0, commandId: 'start' });
  let state = room.service.load(name), G = state.G;
  for (let i = 0; i < 3; i++) await send(room, peers[i], 'official:act', {
    gid: G.gid, revision: state.revision, commandId: 'info-' + i, action: { a: 'info', w: G.wires.find(w => w.o === i).id }
  });
  const credentials = peers.map(ws => ws.data.officialCredential), gid = G.gid;
  const pair = G.wires.filter(w => w.o === 0).map(own => ({ own, target: G.wires.find(w => w.o !== 0 && w.v === own.v) })).find(p => p.target);
  await send(room, peers[0], 'official:act', { gid, revision: state.revision, commandId: 'cut', action: { a: 'dual', w: pair.target.id, val: pair.own.v } });
  const id = G.pending.id;
  // 休眠不会关闭 socket，构造器只能从附件恢复身份。
  room = new sandbox.GameRoom(ctx, {}); await room.ready;
  state = room.service.load(name); G = state.G;
  assert.equal(G.pending.id, id);
  assert.deepEqual(peers.map(ws => room.attach(ws).officialCredential), credentials);
  await send(room, peers[pair.target.o], 'official:act', { gid, revision: state.revision, commandId: 'answer', action: { a: 'resolve', id, w: pair.target.id } });
  assert(last(peers[0], 'official:view').view.pending.choices);
  assert(!last(peers[pair.target.o], 'official:view').view.pending.choices);
  // 暂停取消闹钟；恢复后机器人工作对应真实持久化闹钟。
  await send(room, peers[0], 'official:pause', { gid, revision: state.revision, commandId: 'pause', paused: true });
  assert.equal(await ctx.storage.getAlarm(), null);
  room = new sandbox.GameRoom(ctx, {}); await room.ready; state = room.service.load(name); G = state.G;
  assert(G.paused); assert.equal(G.pending.id, id);
  await send(room, peers[0], 'official:pause', { gid, revision: state.revision, commandId: 'resume', paused: false });
  await send(room, peers[0], 'official:act', { gid, revision: state.revision, commandId: 'own', action: { a: 'resolve', id, w: pair.own.id } });
  assert(!G.pending);
  // 仅在隔离夹具写入已过期的服务器计时，模拟进程恢复后闹钟触发。
  const timedRecord = structuredClone(ctx.values.get('room')), timed = JSON.parse(timedRecord.snapshot);
  timed.G.mission.rules.timer = 60; timed.G.deadline = Date.now() - 1;
  timedRecord.snapshot = JSON.stringify(timed); await ctx.storage.put('room', timedRecord);
  room = new sandbox.GameRoom(ctx, {}); await room.ready;
  const beforeDet = room.service.load(name).G.det;
  await room.alarm();
  assert.equal(room.service.load(name).G.det, beforeDet + 1);
  assert.equal(JSON.parse(ctx.values.get('room').snapshot).G.det, beforeDet + 1);
  assert(await ctx.storage.getAlarm() > now);
  // 退出计时夹具再断开，闲置清理不受下一回合闹钟影响。
  state = room.service.load(name);
  await send(room, peers[0], 'official:back', { gid, revision: state.revision, commandId: 'back' });
  // 最后一条连接断开才安排闲置清理，清理后同一对象可新建房间。
  for (const ws of peers) { ws.close(); await room.webSocketClose(ws, 1000, '离开'); }
  const expires = ctx.values.get('room').expires;
  assert.equal(await ctx.storage.getAlarm(), expires);
  now = expires + 1; await room.alarm();
  assert(!ctx.values.has('room')); assert(!room.service.load(name));
  await room.fetch(new Request('https://game.pages.dev/ws?room=' + name));
  const ws = [...ctx.sockets].at(-1);
  await room.webSocketMessage(ws, JSON.stringify({ t: 'join', room: name }));
  await send(room, ws, 'official:hello', { ruleset: 'campaign', mid: 1, name: '新房主' });
  assert(last(ws, 'official:welcome').host);
  const foreign = new Socket(); ctx.sockets.add(foreign); foreign.serializeAttachment({ peer: 'wrong' });
  await room.webSocketMessage(foreign, JSON.stringify({ t: 'join', room: 'bb-other' }));
  assert.equal(foreign.readyState, 3);
  console.log('✓ 实际 DO 适配器模拟休眠：连接附件身份、私人决定、暂停恢复、7天清理、新建房间和跨房间拒绝');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
