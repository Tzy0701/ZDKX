// 第38关的视角和隐私基础测试；盲猜动作尚未实现，不能作为完整任务认证。
const assert = require('assert'), BB = require('../js/engine'), M = require('../js/missions'), Bot = require('../js/bot');
function rng(seed = 38) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function game(n = 3, seed = 38, captain = 0) { return BB.createGame(M.get('official-development', 38), seats(n), { captain, rng: rng(seed) }); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function wire(V, id) { return V.players.flatMap(p => p.stands.flat()).find(w => w.id === id); }
function test(name, f) { f(); console.log('✓', name); }

test('第38关2–5人全部队长：48蓝、红2／双人红3、无黄，朝外一根不排序放原架最右侧', () => {
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed * 104729, captain), id = G.officialState.outwardId, special = G.wires[id];
    assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.rmark.n, n === 2 ? 3 : 2); assert.equal(G.ymark.n, 0); assert.equal(G.equip.length, n);
    assert.equal(special.o, captain); assert.equal(id, G.wires.filter(w => w.o === captain).at(-1).id); assert.equal(G.players[captain].stands[special.s].at(-1), id);
    G.players.forEach((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); assert.equal(p.dd, 1); p.stands.forEach(st => { const values = st.filter(w => w !== id).map(w => G.wires[w].v); assert.deepEqual(values, values.slice().sort((a, b) => a - b)); }); });
    assert.equal(BB.setupInfoAllowed(G, special), false); assert.equal(BB.targetAllowed(G, (captain + 1) % n, special), false); assert.equal(BB.equipmentWireAllowed(G, captain, special), false);
    const counts = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...counts) - Math.min(...counts) <= 1);
  }
});

test('直接玩家／观战视角与压缩消息：队长收不到朝外真值，共用包不泄露，其他人私人包可见', () => {
  let blue = false, red = false;
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
    const G = game(n, seed * 104729, captain), id = G.officialState.outwardId, special = G.wires[id]; blue ||= BB.kindOf(special) === 'b'; red ||= BB.kindOf(special) === 'r';
    for (let pi = -1; pi < n; pi++) {
      const V = BB.view(G, pi); assert.equal(wire(V, id).v, pi === captain ? null : special.v); assert.equal(BB.isOutward(V, wire(V, id)), true);
      const pub = BB.packPublic(G), row = pub.players[captain].stands.flat().find(r => r[0] === id); assert.equal(row[1], 0); assert(!row[4]);
      const hand = BB.packHand(G, pi); assert.equal(id in hand, pi >= 0 && pi !== captain);
      const packed = BB.unpack(pub, pi < 0 ? null : hand, pi, BB.packChoice(G, pi)); assert.equal(wire(packed, id).v, pi < 0 || pi === captain ? null : special.v);
      const spoofed = BB.unpack(pub, { [id]: special.v }, captain, null); assert.equal(wire(spoofed, id).v, null);
    }
    G.wires[id].cut = true; for (let pi = -1; pi < n; pi++) assert.equal(wire(BB.view(G, pi), id).v, special.v);
  }
  assert(blue && red);
});

test('初始线索及所有装备拒绝朝外线，不消耗牌；普通宣告不能用未知手牌验证真值', () => {
  const G = game(), captain = G.captain, id = G.officialState.outwardId; reject(G, captain, { a: 'info', w: id });
  G.phase = 'play'; G.turn = captain;
  for (const a of [{ a: 'equip', n: 4, w: id }, { a: 'equip', n: 2, w: id, p: 1 }, { a: 'equip', n: 1, w1: id, w2: 0 }, { a: 'equip', n: 12, w1: id, w2: 0 }, { a: 'dd', ws: [id, 0], val: 3 }]) reject(G, captain, a);
  for (let pi = 0; pi < G.np; pi++) if (pi !== captain) { G.turn = pi; const value = G.wires.find(w => w.o === pi && Number.isInteger(w.v)).v; reject(G, pi, { a: 'dual', w: id, val: value }); }
  G.wires.filter(w => w.o === captain && w.id !== id).forEach(w => { w.cut = true; }); G.turn = captain;
  for (let value = 1; value <= 12; value++) assert.equal(BB.hasValue(G, captain, value), false);
  const before = JSON.stringify(G); assert(BB.act(G, captain, { a: 'red' })); assert.equal(JSON.stringify(G), before);
  const legacy = BB.createGame(M.get('custom', 38), seats(3), { rng: rng() }); assert(!legacy.wires.some(w => BB.isOutward(legacy, w))); assert.equal(M.get('campaign', 38).verified, true);
});

test('队长的机器人概率不读取朝外真值，朝外未知不被数值排序限制', () => {
  let G, swap;
  for (let seed = 1; seed < 500; seed++) {
    G = game(3, seed); const outward = G.wires[G.officialState.outwardId]; if (!Number.isInteger(outward.v)) continue;
    for (let owner = 1; owner < G.np && !swap; owner++) for (const st of G.players[owner].stands) for (let i = 0; i < st.length; i++) {
      const w = G.wires[st[i]], low = i ? G.wires[st[i - 1]].v : -Infinity, high = i + 1 < st.length ? G.wires[st[i + 1]].v : Infinity;
      if (w.v !== outward.v && outward.v >= low && outward.v <= high) { swap = w.id; break; }
    }
    if (swap != null) break;
  }
  assert(swap != null); const other = JSON.parse(JSON.stringify(G)), id = G.officialState.outwardId;
  [other.wires[id].v, other.wires[swap].v] = [other.wires[swap].v, other.wires[id].v]; assert.deepEqual(BB.view(G, 0), BB.view(other, 0));
  const saved = Math.random; let a, b;
  try { Math.random = rng(9123); a = Bot.infer(G, 0, 8000); Math.random = rng(9123); b = Bot.infer(other, 0, 8000); } finally { Math.random = saved; }
  assert.deepEqual(a, b); assert(a[id]); assert(Object.keys(a[id].P).length > 1);
});

test('第38关权威联机视角：2–5人身份、观战视角、重连和重启不泄露队长真值', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb38-visibility-'));
  const wss = { clients: new Set() }, svc = Service(wss, dir), last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-facing' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 38, name: '视角玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 38, revision: room.revision, commandId: '开始' });
      const G = game(n, n * 104729, 0); room.G = G; G.catalog = G.mission.catalog = 'campaign'; G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      const special = G.wires[G.officialState.outwardId], ordinary = G.wires.find(w => w.o === 0 && w.id !== special.id && Number.isInteger(w.v));
      svc.handle(peers[0], 'official:act', { gid: G.gid, revision: room.revision, commandId: '队长标记', action: { a: 'info', w: ordinary.id } });
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(wire(V, special.id).v, pi === 0 ? null : special.v); V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi && w.id !== special.id && !w.cut) assert.equal(w.v, null); })); });
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战', spectator: true }); assert.equal(wire(last(watching, 'official:view').view, special.id).v, special.v);
      svc.handle(watching, 'official:perspective', { pid: room.seats[0].pid }); assert.equal(wire(last(watching, 'official:view').view, special.id).v, null);
      svc.handle(watching, 'official:perspective', { pid: room.seats[1].pid }); assert.equal(wire(last(watching, 'official:view').view, special.id).v, special.v);
      const frozen = JSON.stringify(G); svc.handle(watching, 'official:act', { gid: G.gid, revision: room.revision, commandId: '冒用', action: { a: 'info', w: special.id } }); assert.equal(JSON.stringify(G), frozen);
      const credential = last(peers[0], 'official:welcome').credential, reconnect = peer(name); svc.handle(reconnect, 'hello', { credential, name: '视角玩家0' }); assert.equal(wire(last(reconnect, 'official:view').view, special.id).v, null);
      const restarted = Service(wss, dir), restored = restarted.load(name); assert.equal(restored.G.officialState.outwardId, special.id); assert.equal(restored.G.wires[special.id].v, special.v); assert.equal(wire(BB.view(restored.G, 0), special.id).v, null);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
