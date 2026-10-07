const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 20) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n = 3, seed = 20, captain = 0) { return BB.createGame(M.get('official-development', 20), seats(n), { rng: rng(seed), captain }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a), null, JSON.stringify(a)); }
function reject(G, pi, a) { const before = JSON.stringify(G); assert(BB.act(G, pi, a)); assert.equal(JSON.stringify(G), before); }
function test(name, run) { run(); console.log('✓', name); }
function rig(hands = [[2, 3, 3, 2], [1, 2, 4, 2], [2, 4, 5]]) {
  const G = game(hands.length); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  hands.forEach((hand, o) => hand.forEach((v, i) => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null, ...(i === hand.length - 1 ? { x: true } : {}) }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => Number(!!G.wires[a].x) - Number(!!G.wires[b].x) || G.wires[a].v - G.wires[b].v)); G.phase = 'play'; G.turn = 0; G.turnNo = 1; G.pending = null; G.equip = []; return G;
}
function gear(G, n) { G.equip.push({ n, id: BB.EQUIP[n].id, used: false }); for (let i = 0; i < 2; i++) { const id = G.wires.length; G.wires.push({ id, v: n, o: G.np - 1, s: 0, cut: true, info: null }); G.players.at(-1).stands[0].splice(-1, 0, id); } }
function finish(G, id) { const pd = G.pending, choices = BB.view(G, pd.to).pending.choices; act(G, pd.to, { a: 'resolve', id: pd.id, w: id === undefined ? choices.length ? choices[0] : null : id }); }

test('第20关2–5人来源设置：最后发到的一根为X、双架合计一根、普通区排序及人数调整', () => {
  for (let n = 2; n <= 5; n++) {
    let outOfOrder = false, bottom = false;
    for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 20; seed++) {
      const G = game(n, seed * 104729, captain); assert.equal(G.captain, captain); assert.equal(G.wires.filter(w => BB.kindOf(w) === 'b').length, 48); assert.equal(G.rmark.n, 2); assert.equal(G.rmark.cand.length, n === 2 ? 3 : 2); assert.equal(G.ymark.n, n === 2 ? 4 : 2); assert.equal(G.ymark.cand.length, G.ymark.n); assert.equal(G.equip.length, n);
      assert(!G.equip.some(e => e.n === 2)); assert(!G.equipmentReserve.includes(2)); bottom ||= G.equip.some(e => e.n === 13);
      G.players.forEach((p, pi) => {
        const owned = G.wires.filter(w => w.o === pi), x = owned.filter(w => BB.isX(G, w)); assert.equal(x.length, 1); assert.equal(x[0].id, owned.at(-1).id); assert.equal(p.stands[x[0].s].at(-1), x[0].id);
        assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); assert.equal(BB.setupInfoAllowed(G, x[0]), false);
        p.stands.forEach(st => { const normal = st.map(id => G.wires[id]).filter(w => !BB.isX(G, w)).map(w => w.v); assert.deepEqual(normal, normal.slice().sort((a, b) => a - b)); });
        outOfOrder ||= p.stands[x[0].s].length > 1 && G.wires[p.stands[x[0].s].at(-2)].v > x[0].v;
      });
      const lengths = G.players.flatMap(p => p.stands.map(st => st.length)); assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
      for (let pi = -1; pi < n; pi++) {
        const V = BB.view(G, pi), packed = BB.unpack(BB.packPublic(G), pi < 0 ? null : BB.packHand(G, pi), pi, BB.packChoice(G, pi));
        assert(V.official.unsortedX); assert.equal(V.players.flatMap(p => p.stands.flat()).filter(w => w.x).length, n); assert.equal(packed.players.flatMap(p => p.stands.flat()).filter(w => w.x).length, n);
        V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); })); assert(!JSON.stringify(V).includes('equipmentReserve'));
      }
    }
    assert(outOfOrder); assert(bottom, '开发版不剔除底盒来绕过核实门槛');
  }
});

test('X不能初始标记，普通双人可选双方的X并保留私人重复手牌选择', () => {
  const G = game(3), pi = BB.setupActor(G), x = G.wires.find(w => w.o === pi && w.x); reject(G, pi, { a: 'info', w: x.id }); assert.equal(G.setup[pi], 0);
  const H = rig(), own = H.wires.find(w => w.o === 0 && w.x), target = H.wires.find(w => w.o === 1 && w.x); act(H, 0, { a: 'dual', w: target.id, val: 2 }); finish(H, target.id); assert(BB.view(H, 0).pending.choices.includes(own.id)); finish(H, own.id); assert(H.wires[own.id].cut && H.wires[target.id].cut); assert.equal(H.players[0].dd, 1);
  const I = rig([[2, 2, 2, 2], [1, 1]]); act(I, 0, { a: 'solo', val: 2 }); assert(I.wires.filter(w => w.o === 0).every(w => w.cut));
});

test('普通X猜错仍给真实失败线索、红X仍爆炸；红X须主动公开且不自动胜利', () => {
  const G = rig([[1, 4, 5], [2, 3, 4]]), x = G.wires.find(w => w.o === 1 && w.x); act(G, 0, { a: 'dual', w: x.id, val: 1 }); finish(G, x.id); assert.equal(G.det, 1); assert.deepEqual(G.wires[x.id].info, { t: 'v', v: 4 });
  const H = rig([[1, 4], [2, 1.5]]), red = H.wires.find(w => w.o === 1 && w.x); act(H, 0, { a: 'dual', w: red.id, val: 1 }); finish(H); assert.equal(H.phase, 'lost');
  const I = rig([[1.5], [2, 2]]); act(I, 0, { a: 'red' }); assert.equal(I.phase, 'play'); assert(I.wires[0].cut && I.wires[0].x);
});

test('标签、便利贴、对讲机、探测器及修饰不能指X，拒绝不耗牌；预先稳定器也不能保护X', () => {
  const G = rig(); for (const n of [1, 2, 3, 4, 9, 10, 12]) gear(G, n);
  const own = G.wires.find(w => w.o === 0 && w.x), target = G.wires.find(w => w.o === 1 && w.x), normal = G.wires.find(w => w.o === 1 && !w.x && w.v === 2);
  for (const a of [{ a: 'equip', n: 1, w1: own.id, w2: G.players[0].stands[0].at(-2) }, { a: 'equip', n: 12, w1: own.id, w2: G.players[0].stands[0][0] }, { a: 'equip', n: 4, w: own.id }, { a: 'equip', n: 2, w: G.players[0].stands[0][0], p: 1 }, { a: 'dd', ws: [normal.id, target.id], val: 2 }, { a: 'equip', n: 3, ws: G.players[1].stands[0].slice(-3), val: 2 }, { a: 'dual', w: target.id, val: 2, stab: true }, { a: 'dual', w: target.id, val: 2, xy: true, vals: [2, 3] }]) reject(G, 0, a);
  assert(G.equip.every(e => !e.used)); assert.equal(G.players[0].dd, 1);
  act(G, 0, { a: 'equip', n: 9 }); assert(G.stab); reject(G, 0, { a: 'dual', w: target.id, val: 2 }); assert(G.stab);
});

test('装备不把自己X当匹配线或宣告来源；正常复制仍可选，旧决定不能借X完成探测器', () => {
  const G = rig(), target = G.wires.find(w => w.o === 1 && !w.x && w.v === 2), other = G.wires.find(w => w.o === 1 && !w.x && w.v === 4), x = G.wires.find(w => w.o === 0 && w.x), normal = G.wires.find(w => w.o === 0 && !w.x && w.v === 2);
  act(G, 0, { a: 'dd', ws: [target.id, other.id], val: 2 }); finish(G, target.id); assert(!BB.view(G, 0).pending.choices.includes(x.id)); reject(G, 0, { a: 'resolve', id: G.pending.id, w: x.id }); finish(G, normal.id); assert(!G.wires[x.id].cut && G.wires[normal.id].cut);
  const H = rig([[3, 4, 2], [1, 2, 5]]); const ids = H.wires.filter(w => w.o === 1 && !w.x).map(w => w.id); reject(H, 0, { a: 'dd', ws: ids, val: 2 }); assert.equal(H.players[0].dd, 1);
  gear(H, 10); reject(H, 0, { a: 'dual', w: ids[0], val: 3, xy: true, vals: [3, 2] }); assert(!H.equip.find(e => e.n === 10).used);
});

test('雷达逐架忽略X，超级自动排除X，三重仅余两根普通线时可选两根', () => {
  const G = rig([[7, 3, 9], [1, 4, 7]]); gear(G, 8); act(G, 0, { a: 'equip', n: 8, val: 7 }); assert.deepEqual(G.radar.res, [[true], [false]]);
  const H = rig([[7, 3, 9], [1, 4, 7]]); gear(H, 5); act(H, 0, { a: 'equip', n: 5, p: 1, s: 0, val: 7 }); assert.equal(H.pending.ids.length, 2); assert(H.pending.ids.every(id => !H.wires[id].x)); finish(H); assert.equal(H.det, 1); assert(!H.wires.find(w => w.o === 1 && w.x).cut);
  const I = rig([[7, 3, 9], [1, 4, 7]]); gear(I, 3); act(I, 0, { a: 'equip', n: 3, ws: I.wires.filter(w => w.o === 1 && !w.x && !w.cut).map(w => w.id), val: 7 }); assert.equal(I.pending.ids.length, 2); finish(I); assert.equal(I.det, 1);
});

test('机器人把未知X当独立空档，已知X也不能给普通区制造排序边界；旧存档不启用X', () => {
  let G, owner, x, high;
  for (let seed = 1; seed < 100; seed++) { G = game(3, seed * 104729); owner = 1; x = G.wires.find(w => w.o === owner && w.x); high = G.wires.filter(w => w.o === owner && w.s === x.s && !w.x && BB.kindOf(w) === 'b').sort((a, b) => b.v - a.v)[0]; if (BB.kindOf(x) === 'b' && high.v > x.v) break; }
  while (G.phase === 'setup') { const pi = BB.setupActor(G); act(G, pi, pi === owner ? { a: 'info', w: high.id } : Bot.decide(G, pi)); }
  const inferred = Bot.infer(G, 0, 7000); assert(Object.entries(inferred[x.id].P).some(([v, p]) => Number(v) < high.v && p > 0));
  const legacy = BB.createGame(M.get('custom', 20), seats(3), { rng: rng() }); assert(!legacy.wires.some(w => BB.isX(legacy, w))); assert.equal(M.get('campaign', 20).verified, false);
});

test('第20关100局来源配置全信息通关，64局推理机器人合法终局', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed * 104729);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.phase === 'setup') a = Bot.decide(G, pi);
      else if (G.pending) a = { a: 'resolve', id: G.pending.id, w: G.pending.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : G.pending.ids.find(id => G.pending.vals.some(v => BB.matches(G.wires[id], v))) };
      else { const own = G.wires.filter(w => w.o === pi && !w.cut); if (own.every(w => BB.kindOf(w) === 'r')) a = { a: 'red' }; else { const value = BB.annOf(own.find(w => BB.kindOf(w) !== 'r')); a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w, value)).id }; } }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) { const G = game(n, seed * 104729); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase)); }
  console.log('  100局通关，共' + actions + '个合法动作；64局机器人合法终局。');
});

test('第20关2–5人权威联机：公开X不泄值、装备自己的X排除、暂停重连重启及过期去重', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb20-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-x' + n, peers = Array.from({ length: n }, () => peer(name)); peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 20, name: 'X玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 20, revision: room.revision, commandId: '开始' });
      let G, ownX, normal, target, companion;
      for (let seed = 1; seed < 500; seed++) {
        G = game(n, seed * 104729); ownX = G.wires.find(w => w.o === 0 && w.x); normal = G.wires.find(w => w.o === 0 && !w.x && w.v === ownX.v);
        target = G.wires.find(w => w.o !== 0 && !w.x && w.v === ownX.v);
        companion = target && G.wires.find(w => w.o === target.o && w.s === target.s && !w.x && w.id !== target.id);
        if (BB.kindOf(ownX) === 'b' && normal && target && companion) break;
      }
      assert(normal && target && companion); room.G = G; G.catalog = G.mission.catalog = 'campaign'; G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; p.name = room.seats[pi].name; });
      function send(pi, commandId, action, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, pi: 0, action }); }
      let k = 0; while (G.phase === 'setup') { const pi = BB.setupActor(G); send(pi, '标记' + k++, Bot.decide(G, pi)); }
      const watching = peer(name); svc.handle(watching, 'hello', { name: '观战者', spectator: true });
      peers.forEach((ws, pi) => { const V = last(ws, 'official:view').view; assert.equal(V.players.flatMap(p => p.stands.flat()).filter(w => w.x).length, n); V.players.forEach((p, owner) => p.stands.flat().forEach(w => { if (owner !== pi) assert.equal(w.v, null); })); });
      send(0, '探测普通线', { a: 'dd', ws: [target.id, companion.id], val: ownX.v }); send(target.o, '公开命中', { a: 'resolve', id: G.pending.id, w: target.id });
      const decision = G.pending.id; assert(G.pending.usesEquipment); assert(!last(peers[0], 'official:view').view.pending.choices.includes(ownX.id)); assert(!('choices' in last(watching, 'official:view').view.pending));
      svc.handle(peers[0], 'official:pause', { paused: true, gid: G.gid, revision: room.revision, commandId: '暂停' }); const frozen = JSON.stringify(G); send(0, '暂停中剪线', { a: 'resolve', id: decision, w: normal.id }); assert.equal(JSON.stringify(G), frozen);
      svc.handle(peers[0], 'official:pause', { paused: false, gid: G.gid, revision: room.revision, commandId: '继续' }); const credential = last(peers[0], 'official:welcome').credential, reconnected = peer(name);
      svc.handle(reconnected, 'hello', { credential, name: 'X玩家0' }); assert(!last(reconnected, 'official:view').view.pending.choices.includes(ownX.id));
      const restarted = Service(wss, dir), state = restarted.load(name); assert(state.G.wires[ownX.id].x); assert.equal(state.G.players[0].stands[ownX.s].at(-1), ownX.id); assert(state.G.pending.usesEquipment);
      const saved = JSON.stringify(state.G); send(0, '非法自剪X', { a: 'resolve', id: decision, w: ownX.id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved); send(0, '旧决定', { a: 'resolve', id: decision - 1, w: normal.id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      send(0, '选择普通复制', { a: 'resolve', id: decision, w: normal.id }, restarted, state, reconnected); const revision = state.revision; send(0, '选择普通复制', { a: 'resolve', id: decision, w: normal.id }, restarted, state, reconnected); assert.equal(state.revision, revision); assert(state.G.wires[normal.id].cut && !state.G.wires[ownX.id].cut); assert.equal(state.G.players[0].dd, 0); assert(state.G.players.slice(1).every(p => p.dd === 1));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
