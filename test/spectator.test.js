const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const officialService = require('../server/official');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-busters-spectator-'));
const wss = { clients: new Set() };
const service = officialService(wss, dir);
function peer(room = 'bb-spectator-test') {
  const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } };
  wss.clients.add(ws);
  return ws;
}
function last(ws, topic) { return ws.messages.filter(m => m.topic === topic).at(-1)?.data; }
try {
  const host = peer(), guest = peer(), other = peer(), hostTab = peer();
  service.handle(host, 'official:hello', { create: true, ruleset: 'physical', mid: 1, name: 'Host' });
  service.handle(guest, 'hello', { name: 'Guest' });
  service.handle(other, 'hello', { name: 'Other' });
  const hostIdentity = last(host, 'official:welcome');
  const guestIdentity = last(guest, 'official:welcome');
  service.handle(hostTab, 'hello', { credential: hostIdentity.credential, name: 'Host tab' });

  service.handle(host, 'official:role', { role: 'spectator' });
  assert.strictEqual(last(host, 'official:welcome').role, 'spectator');
  assert.strictEqual(last(hostTab, 'official:welcome').role, 'spectator');
  const switchedWelcome = hostTab.messages.map(m => m.topic).lastIndexOf('official:welcome');
  const switchedLobby = hostTab.messages.map(m => m.topic).lastIndexOf('official:lobby');
  assert(switchedWelcome < switchedLobby, 'shared credential role welcome arrives before lobby update');
  assert.strictEqual(service.load(host.room).seats.length, 2);
  assert.strictEqual(service.load(host.room).observers.length, 1);
  service.handle(host, 'official:start', { mid: 1, revision: service.load(host.room).revision, commandId: 'spectator-host-start' });
  assert(service.load(host.room).G, 'observer host retains management authority');

  const watcher = peer();
  service.handle(watcher, 'official:hello', { spectator: true, name: 'Watcher' });
  const watcherIdentity = last(watcher, 'official:welcome');
  assert.strictEqual(watcherIdentity.role, 'spectator');
  assert.strictEqual(service.load(host.room).seats.length, 2);
  const room = service.load(host.room);
  const targetPid = room.G.players[0].pid;
  service.handle(watcher, 'official:perspective', { pid: targetPid });
  const watcherView = last(watcher, 'official:view').view;
  assert.strictEqual(watcherView.me, -1);
  assert.strictEqual(watcherView.spectator, true);
  assert.strictEqual(watcherView.perspective, targetPid);
  assert(watcherView.players[0].stands.flat().some(w => !w.cut && w.v !== null));
  assert.strictEqual(watcherView.players[1].stands.flat().every(w => w.cut || w.v === null), true);
  const watcherTab = peer();
  service.handle(watcherTab, 'hello', { credential: watcherIdentity.credential, name: 'Watcher tab' });
  const publicRevision = room.revision, lobbyCount = watcher.messages.filter(m => m.topic === 'official:lobby').length;
  service.handle(watcher, 'official:perspective', { pid: null });
  assert.strictEqual(room.revision, publicRevision);
  assert.strictEqual(watcher.messages.filter(m => m.topic === 'official:lobby').length, lobbyCount);
  for (const c of [watcher, watcherTab]) {
    const publicView = last(c, 'official:view').view;
    assert.strictEqual(publicView.perspective, null);
    assert(publicView.players.every((p, i) => i === publicView.me || p.stands.flat().every(w => w.cut || w.v === null)));
  }
  service.handle(watcher, 'official:perspective', { pid: targetPid });
  assert.strictEqual(last(watcherTab, 'official:view').view.perspective, targetPid);

  room.G.pending = { type: 'cut', id: 'private', from: 1, to: 0, ids: [], vals: [], step: 'target' };
  room.revision++;
  service.handle(watcher, 'official:perspective', { pid: targetPid });
  const pending = last(watcher, 'official:view').view.pending;
  assert(!Object.hasOwn(pending, 'choices'));
  assert(!Object.hasOwn(pending, 'noSafe'));

  const before = JSON.stringify(room.G), revision = room.revision;
  service.handle(watcher, 'official:act', { gid: room.G.gid, revision, commandId: 'forged', action: { a: 'info', w: 0 }, pid: guestIdentity.pid });
  assert.strictEqual(JSON.stringify(room.G), before);
  service.handle(watcher, 'chat', { text: 'spectator chat' });
  assert(!last(guest, 'chat'));
  const staleIntent = peer();
  service.handle(staleIntent, 'hello', { credential: guestIdentity.credential, spectator: true, name: 'Guest reconnect' });
  assert.strictEqual(last(staleIntent, 'official:error').msg, '牌局进行中不能转换座位身份');
  assert.strictEqual(last(staleIntent, 'official:welcome').role, 'player');
  assert.strictEqual(staleIntent.officialCredential, guestIdentity.credential);
  assert.strictEqual(last(staleIntent, 'official:view').view.me, 0);
  const playerBefore = JSON.stringify(room);
  service.handle(staleIntent, 'official:perspective', { pid: room.G.players[1].pid });
  service.handle(staleIntent, 'official:role', { role: 'spectator' });
  service.handle(watcher, 'official:role', { role: 'player' });
  assert.strictEqual(JSON.stringify(room), playerBefore, 'midgame identity/perspective requests cannot change the room');
  assert.strictEqual(last(staleIntent, 'official:view').view.spectator, false);
  assert(last(staleIntent, 'official:view').view.players[1].stands.flat().every(w => w.v === null));

  const resumed = peer();
  service.handle(resumed, 'hello', { credential: watcherIdentity.credential, name: 'Watcher resumed' });
  assert.strictEqual(last(resumed, 'official:welcome').role, 'spectator');
  assert.strictEqual(last(resumed, 'official:welcome').perspective, targetPid);
  const restored = officialService({ clients: new Set() }, dir).load(host.room);
  assert.strictEqual(restored.observers.length, 2);
  assert.strictEqual(restored.observers.find(o => o.pid === watcherIdentity.pid).perspective, targetPid);
  assert(!JSON.stringify(last(host, 'official:lobby').observers).includes(watcherIdentity.credential));

  let commandRevision = room.revision;
  service.handle(host, 'official:pause', { paused: true, gid: room.G.gid, revision: commandRevision, commandId: 'observer-pause' });
  assert.strictEqual(room.G.paused, true);
  service.handle(hostTab, 'official:pause', { paused: false, gid: room.G.gid, revision: room.revision, commandId: 'observer-unpause' });
  assert.strictEqual(room.G.paused, false);
  service.handle(hostTab, 'official:back', { gid: room.G.gid, revision: room.revision, commandId: 'observer-back' });
  assert.strictEqual(room.G, null);
  service.handle(host, 'official:role', { role: 'player' });
  assert.strictEqual(last(hostTab, 'official:welcome').role, 'player');

  const fullHost = peer('bb-spectator-full'), fullService = service;
  fullService.handle(fullHost, 'official:hello', { create: true, ruleset: 'physical', mid: 1, name: 'Full host' });
  for (let i = 0; i < 4; i++) fullService.handle(peer('bb-spectator-full'), 'hello', { name: 'P' + i });
  const fullWatcher = peer('bb-spectator-full');
  fullService.handle(fullWatcher, 'official:hello', { name: 'Waiting' });
  const fullIdentity = last(fullWatcher, 'official:welcome');
  assert.strictEqual(fullIdentity.role, 'spectator');
  assert.strictEqual(fullService.load('bb-spectator-full').seats.length, 5);
  fullService.handle(fullWatcher, 'official:role', { role: 'player' });
  assert.strictEqual(last(fullWatcher, 'official:error').msg, '没有可用玩家座位');
  assert.strictEqual(fullService.load('bb-spectator-full').seats.length, 5);

  const firstWatch = peer('bb-spectator-first-watch');
  fullService.handle(firstWatch, 'official:hello', { create: true, ruleset: 'physical', mid: 1, spectator: true, name: 'First watcher' });
  assert.strictEqual(last(firstWatch, 'official:welcome').host, true);
  console.log('✓ spectator roles, observer host authority, private perspective views, resume and seat-only actions');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
