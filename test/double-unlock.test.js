const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 12) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n, seed = 12, captain = 0) { return BB.createGame(M.get('official-development', 12), seats(n), { captain, rng: rng(seed) }); }
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null); }
function rejected(G, pi, a) { const before = JSON.stringify(G); const error = BB.act(G, pi, a); assert(error); assert.equal(JSON.stringify(G), before); return error; }
function test(name, run) { run(); console.log('✓', name); }
function rig(n = 3) {
  const G = game(n); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  const hands = [[...Array.from({ length: 12 }, (_, i) => [i + 1, i + 1]).flat(), 1.1, 2.1], [...Array.from({ length: 12 }, (_, i) => [i + 1, i + 1]).flat(), 3.1, 4.1], ...Array.from({ length: n - 2 }, () => [1.5])];
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.equip = [{ n: 3, numberUnlock: 4 }, { n: 4, numberUnlock: 5 }, { n: 13, numberUnlock: 2 }].map(e => ({ ...e, id: BB.EQUIP[e.n].id, used: false, numberDiscarded: false, doubleReady: false }));
  G.officialState.equipmentNumbers = { deck: [1, 3, 6, 7, 8, 9, 10, 11, 12], discarded: [] }; G.equipmentReserve = [1, 6];
  G.phase = 'play'; G.turn = 0; G.turnNo = 1; return G;
}
function dual(G, value) {
  const pi = G.turn, own = G.wires.filter(w => w.o === pi && !w.cut && BB.matches(w.v, value)).at(-1), target = G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w.v, value));
  assert(own && target);
  act(G, pi, { a: 'dual', w: target.id, val: value });
  const id = G.pending.id; rejected(G, pi, { a: 'resolve', id, w: own.id });
  act(G, target.o, { a: 'resolve', id, w: target.id });
  assert.equal(BB.view(G, -1).pending.hit, target.id); assert(!('choices' in BB.view(G, -1).pending));
  act(G, pi, { a: 'resolve', id, w: own.id }); assert(G.wires[own.id].cut);
  while (G.phase === 'play' && G.wires.filter(w => w.o === G.turn && !w.cut).every(w => BB.kindOf(w.v) === 'r')) act(G, G.turn, { a: 'red' });
}
function cutRaw(G, value, count) { G.wires.filter(w => BB.matches(w.v, value)).slice(0, count).forEach(w => { w.cut = true; }); }

test('第12关2–5人来源设置、独立且不重复的数字卡、线架和私有牌堆', () => {
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) for (let seed = 1; seed <= 5; seed++) {
    const G = game(n, seed, captain);
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48); assert.equal(G.ymark.n, 4); assert.equal(G.ymark.cand.length, 4);
    assert.equal(G.rmark.n, n === 2 ? 2 : 1); assert.equal(G.rmark.cand.length, G.rmark.n); assert.equal(G.equip.length, n);
    assert.equal(G.infoN, 1); assert(G.players.every(p => p.dd === 1));
    const numbers = G.equip.map(e => e.numberUnlock).concat(G.officialState.equipmentNumbers.deck);
    assert.deepEqual(numbers.slice().sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
    const lengths = G.players.flatMap((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); return p.stands.map(s => s.length); });
    assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
    for (let pi = -1; pi < n; pi++) { const V = BB.view(G, pi); assert(V.equip.every(e => !e.open && e.unlockConditions.length === 2)); assert(!JSON.stringify(V).includes('"deck"')); assert(!JSON.stringify(V).includes('equipmentReserve')); }
  }
});

test('印刷和数字两项独立，先后顺序无关；数字同值一对即可，达到四根仍保留可用', () => {
  for (const order of [[3, 4], [4, 3]]) {
    const G = rig(); dual(G, order[0]); assert(!BB.equipUnlocked(G, 3));
    assert.equal(G.equip[0].numberDiscarded, order[0] === 4);
    const snapshot = BB.view(G, 0).equip[0]; assert.equal(snapshot.unlockConditions.filter(c => c.met).length, 1);
    assert(rejected(G, G.turn, { a: 'equip', n: 3 }).includes('同时满足'));
    dual(G, order[1]); assert(BB.equipUnlocked(G, 3)); assert(G.equip[0].numberDiscarded);
    assert.deepEqual(G.officialState.equipmentNumbers.discarded, [4]); assert.equal(G.log.filter(x => x.t.includes('三重探测器') && x.t.includes('两项条件')).length, 1);
  }
  const G = rig(); G.equip[0].numberUnlock = 3; dual(G, 3); assert(BB.equipUnlocked(G, 3)); assert.equal(BB.cutCount(G, 3), 2);
  dual(G, 3); assert.equal(BB.cutCount(G, 3), 4); assert(BB.equipUnlocked(G, 3)); assert.deepEqual(G.officialState.equipmentNumbers.discarded, [3]);
  assert(G.players.every(p => p.dd === 1));
});

test('个人探测器无双门槛；锁定修饰卡拒绝不变，团队探测器使用后各自角色不变', () => {
  const G = rig(), own = G.wires.find(w => w.o === 0 && w.v === 1), target = G.wires.find(w => w.o === 1 && w.v === 1);
  const pair = G.players[1].stands[0].filter(id => !G.wires[id].cut && G.wires[id].v === 1);
  act(G, 0, { a: 'dd', ws: pair, val: 1 }); assert.equal(G.players[0].dd, 0);
  act(G, 1, { a: 'resolve', id: G.pending.id, w: target.id }); act(G, 0, { a: 'resolve', id: G.pending.id, w: own.id });
  assert.equal(G.players[1].dd, 1);
  const H = rig(); H.equip[0].n = 10; H.equip[0].id = BB.EQUIP[10].id;
  rejected(H, 0, { a: 'dual', w: target.id, val: 1, xy: true, vals: [1, 2] });
  const J = rig(); dual(J, 3); dual(J, 4);
  const pi = J.turn, ids = J.players[1 - pi].stands[0].filter(id => !J.wires[id].cut).slice(0, 3), value = J.wires[ids[0]].v;
  act(J, pi, { a: 'equip', n: 3, ws: ids, val: value }); assert(J.equip[0].used); assert(J.players.every(p => p.dd === 1));
  const pd = J.pending; act(J, pd.to, { a: 'resolve', id: pd.id, w: ids[0] }); act(J, pi, { a: 'resolve', id: J.pending.id, w: J.wires.filter(w => w.o === pi && !w.cut && w.v === value).at(-1).id });
  rejected(J, J.turn, { a: 'equip', n: 3, ws: ids, val: value });
});

test('开发版底盒必须满足黄与附加数字，新增装备各分新卡并沿用先前剪线进度', () => {
  const G = rig(); dual(G, 'Y'); assert(!BB.equipUnlocked(G, 13)); assert(!G.log.some(x => x.t.includes('双层底盒') && x.t.includes('已解锁')));
  rejected(G, 2, { a: 'equip', n: 13 }); dual(G, 2); assert(BB.equipUnlocked(G, 13));
  cutRaw(G, 1, 2); cutRaw(G, 3, 2); cutRaw(G, 6, 2); const turn = G.turn, turnNo = G.turnNo;
  act(G, 2, { a: 'equip', n: 13 }); assert.equal(G.turn, turn); assert.equal(G.turnNo, turnNo); assert.equal(G.equip.length, 5);
  assert(G.equip.find(e => e.n === 13).used); assert.equal(G.equipmentReserve.length, 0);
  const added = G.equip.filter(e => [1, 6].includes(e.n)); assert.deepEqual(added.map(e => e.numberUnlock).sort(), [1, 3]);
  assert(added.every(e => e.numberDiscarded && BB.equipUnlocked(G, e.n)));
  assert.equal(G.officialState.equipmentNumbers.deck.length, 7); assert.equal(new Set(G.equip.map(e => e.numberUnlock)).size, 5);
  assert.deepEqual(G.officialState.equipmentNumbers.discarded.slice().sort(), [1, 2, 3]);
  rejected(G, 2, { a: 'equip', n: 13 });
});

test('开发版100局全信息通关及64局合法机器人终局；公开战役继续保留改编第12关', () => {
  let actions = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.pending?.type === 'cut') { const pd = G.pending; a = { a: 'resolve', id: pd.id, w: pd.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : pd.ids.find(id => pd.vals.some(v => BB.matches(G.wires[id].v, v))) }; }
      else if (G.phase === 'setup') a = Bot.decide(G, pi);
      else { const own = G.wires.filter(w => w.o === pi && !w.cut); if (own.every(w => BB.kindOf(w.v) === 'r')) a = { a: 'red' }; else { const value = BB.annOf(own.find(w => BB.kindOf(w.v) !== 'r').v); a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && BB.matches(w.v, value)).id }; } }
      assert(a); act(G, pi, a); actions++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) {
    const G = game(n, seed, seed % n); for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); } assert(['won', 'lost'].includes(G.phase));
  }
  assert.equal(M.get('campaign', 12).verified, false); assert.equal(M.get('physical', 12), null); assert(!BB.createGame(M.get('custom', 12), seats(3), { rng: rng() }).officialState);
  console.log('  100局全信息通关，' + actions + '个合法动作；另64局推理机器人均合法终局。');
});

test('第12关开发版2–5人联机：私有选择、暂停、重连重启、旧决定与重复请求不变', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb12-authority-')), wss = { clients: new Set() }, svc = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(room) { const ws = { room, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-unlock' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => svc.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 12, name: '玩家' + pi }));
      const room = svc.load(name); svc.handle(peers[0], 'official:start', { mid: 12, revision: room.revision, commandId: '开始' });
      // 仅测试夹具启用尚未认证的模块；正常开局仍使用公开改编任务。
      room.G = rig(n); room.G.equip[0].numberUnlock = 3; room.G.catalog = room.G.mission.catalog = 'campaign';
      room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      function send(pi, commandId, a, service = svc, state = room, ws = peers[pi]) { service.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, action: a }); }
      const own = room.G.wires.filter(w => w.o === 0 && w.v === 3).at(-1), target = room.G.wires.find(w => w.o === 1 && w.v === 3);
      send(0, '宣告', { a: 'dual', w: target.id, val: 3 });
      const pd = room.G.pending;
      assert(last(peers[1], 'official:view').view.pending.choices); assert(!last(peers[0], 'official:view').view.pending.choices);
      for (const ws of peers) assert(!JSON.stringify(last(ws, 'official:view').view).includes('"deck"'));
      assert.equal(BB.setPaused(room.G, true), null); const before = JSON.stringify(room.G);
      send(1, '暂停中回应', { a: 'resolve', id: pd.id, w: target.id }); assert.equal(JSON.stringify(room.G), before);
      assert.equal(BB.setPaused(room.G, false), null);
      send(1, '回应', { a: 'resolve', id: pd.id, w: target.id });
      const credential = last(peers[0], 'official:welcome').credential, reconnected = peer(name);
      svc.handle(reconnected, 'hello', { credential, name: '玩家0' });
      assert.equal(last(reconnected, 'official:view').view.pending.step, 'own');
      const wss2 = { clients: new Set([...peers, reconnected]) }, restarted = Service(wss2, dir), state = restarted.load(name);
      assert.equal(state.G.officialState.module, 'double-equipment-unlock'); assert.deepEqual(state.G.officialState.equipmentNumbers.deck, room.G.officialState.equipmentNumbers.deck);
      const saved = JSON.stringify(state.G);
      send(0, '旧决定', { a: 'resolve', id: pd.id - 1, w: own.id }, restarted, state, reconnected); assert.equal(JSON.stringify(state.G), saved);
      send(0, '选自己的第二根', { a: 'resolve', id: pd.id, w: own.id }, restarted, state, reconnected);
      assert(state.G.wires[own.id].cut); assert(BB.equipUnlocked(state.G, 3));
      const revision = state.revision; send(0, '选自己的第二根', { a: 'resolve', id: pd.id, w: own.id }, restarted, state, reconnected); assert.equal(state.revision, revision);
      const final = last(reconnected, 'official:view').view;
      assert(final.equip[0].open); assert(final.equip[0].unlockConditions[1].discarded);
      assert(final.players.every(p => p.dd === 1));
      const again = Service(wss2, dir), loaded = again.load(name); send(0, '选自己的第二根', { a: 'resolve', id: pd.id, w: own.id }, again, loaded, reconnected); assert.equal(loaded.revision, revision);
      const V = BB.unpack(BB.packPublic(loaded.G), BB.packHand(loaded.G, 0), 0, BB.packChoice(loaded.G, 0)); assert.deepEqual(V.equip[0], final.equip[0]);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
