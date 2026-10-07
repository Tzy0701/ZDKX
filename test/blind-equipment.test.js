const assert = require('assert');
const BB = require('../js/engine'), Bot = require('../js/bot'), M = require('../js/missions');
const seats = n => Array.from({ length: n }, (_, i) => ({ pid: 'p' + i, name: '玩家' + i }));
function rng(seed = 15) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function game(n, seed = 15, captain = 0) { return BB.createGame(M.get('official-development', 15), seats(n), { captain, rng: rng(seed) }); }
function rig(n = 3) {
  const G = game(n); G.wires = []; G.players.forEach(p => { p.stands = [[]]; });
  const hands = [[1, 1, 2, 2, 7], [1, 1, 2, 2, 8], ...Array.from({ length: n - 2 }, () => [3, 3, 5, 5, 1.5])];
  hands.forEach((hand, o) => hand.forEach(v => { const id = G.wires.length; G.wires.push({ id, v, o, s: 0, cut: false, info: null }); G.players[o].stands[0].push(id); }));
  G.players.forEach(p => p.stands[0].sort((a, b) => G.wires[a].v - G.wires[b].v));
  G.equip = [6, 4, 11, 7, 12].slice(0, n).map((n, i) => ({ n, id: BB.EQUIP[n].id, hidden: true, slot: 'back-' + i, used: false }));
  G.officialState.blind = { value: 1, deck: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], step: 'active' }; G.phase = 'play'; G.turn = 0; G.turnNo = 1; return G;
}
function act(G, pi, a) { assert.equal(BB.act(G, pi, a, { rng: rng() }), null); }
function rejected(G, pi, a) { const before = JSON.stringify(G); const error = BB.act(G, pi, a); assert(error); assert.equal(JSON.stringify(G), before); return error; }
function dual(G, pi, target, own) {
  act(G, pi, { a: 'dual', w: target.id, val: own.v });
  act(G, target.o, { a: 'resolve', id: G.pending.id, w: target.id });
  act(G, pi, { a: 'resolve', id: G.pending.id, w: own.id });
}
function finishCurrent(G) {
  for (let pair = 0; pair < 2; pair++) {
    const pi = G.turn, own = G.wires.filter(w => w.o === pi && !w.cut && w.v === 1).at(-1), target = G.wires.find(w => w.o !== pi && !w.cut && w.v === 1);
    dual(G, pi, target, own);
  }
  assert.equal(G.pending.type, 'equipment-reveal');
}
function test(name, run) { run(); console.log('✓', name); }

test('第15关2–5人设置：红线候选、队长线架、个人探测器、有限初始线索与隐藏装备', () => {
  for (let n = 2; n <= 5; n++) for (let captain = 0; captain < n; captain++) {
    const G = game(n, 15 + captain, captain);
    assert.equal(G.rmark.n, n === 2 ? 2 : 1); assert.equal(G.rmark.cand.length, 3); assert.equal(G.ymark.n, 0);
    assert.equal(G.wires.filter(w => Number.isInteger(w.v)).length, 48); assert.equal(G.equip.length, n); assert.equal(G.infoN, 1);
    assert(G.players.every(p => p.dd === 1)); assert(G.equip.every(e => e.hidden && e.n <= 12 && !BB.equipUnlocked(G, e.n)));
    const lengths = G.players.flatMap((p, pi) => { assert.equal(p.stands.length, n === 2 || n === 3 && pi === captain ? 2 : 1); return p.stands.map(s => s.length); });
    assert(Math.max(...lengths) - Math.min(...lengths) <= 1);
    for (let pi = -1; pi < n; pi++) {
      const V = BB.view(G, pi); assert(V.equip.every(e => !('n' in e) && !('id' in e) && e.hidden));
      assert(!JSON.stringify(V).includes('"deck"')); assert(!JSON.stringify(V).includes('"equipmentReserve"'));
      assert.equal(V.official.blindEquipment.remaining, 11); assert.equal(V.official.blindEquipment.hidden, n);
    }
    assert.equal(BB.seqAllowed(G, 1), true); assert.equal(BB.seqAllowed(G, 12), true);
    assert.equal(rejected(G, captain, { a: 'equip', n: G.equip[0].n }), rejected(G, captain, { a: 'equip', n: 13 }));
  }
});

test('目标四根才奖励；任意同值线、团队盲选、无编号解锁及普通装备时机', () => {
  const G = rig(); G.det = 1;
  dual(G, 0, G.wires.find(w => w.o === 1 && w.v === 1), G.wires.filter(w => w.o === 0 && w.v === 1).at(-1));
  assert.equal(G.pending, null); assert.equal(G.officialState.blind.value, 1); assert(G.equip.every(e => e.hidden));
  const firstId = G.players[0].stands[0].find(id => G.wires[id].v === 1 && !G.wires[id].cut); assert(firstId != null);
  dual(G, 1, G.wires[firstId], G.wires.find(w => w.o === 1 && w.v === 1 && !w.cut));
  const pd = G.pending, start = G.turnNo; assert.equal(pd.type, 'equipment-reveal'); assert.equal(G.turn, 1);
  for (let pi = -1; pi < G.np; pi++) assert.deepEqual(BB.view(G, pi).pending.slots, ['back-0', 'back-1', 'back-2']);
  rejected(G, 1, { a: 'solo', val: 2 }); rejected(G, 0, { a: 'equipment-reveal', id: pd.id, slot: '未知位置' });
  act(G, 0, { a: 'equipment-reveal', id: pd.id, slot: 'back-0' });
  assert.equal(G.turnNo, start + 1); assert.equal(G.turn, 2); assert.equal(G.officialState.blind.value, 2);
  assert.equal(BB.view(G, -1).equip[0].n, 6); assert(BB.equipUnlocked(G, 6)); assert.equal(BB.cutCount(G, 6), 0);
  assert(G.equip.slice(1).every(e => e.hidden)); assert(G.players.every(p => p.dd === 1));
  act(G, 0, { a: 'equip', n: 6 }); assert.equal(G.det, 0); assert(G.equip[0].used);
  rejected(G, 0, { a: 'equip', n: 6 }); rejected(G, 0, { a: 'equipment-reveal', id: pd.id, slot: 'back-1' });
});

test('已经完成的数字跳过且不重复奖励；可放弃奖励、无背面装备时继续正常拆线', () => {
  const G = rig(); G.wires.filter(w => w.v === 2).forEach(w => { w.cut = true; }); finishCurrent(G);
  const pd = G.pending; act(G, 2, { a: 'equipment-reveal', id: pd.id, slot: null });
  assert(G.equip.every(e => e.hidden)); assert.equal(G.officialState.blind.value, 3); assert.equal(G.officialState.blind.deck.length, 9);
  const H = rig(); H.equip.forEach(e => { e.hidden = false; });
  for (let pair = 0; pair < 2; pair++) { const pi = H.turn; dual(H, pi, H.wires.find(w => w.o !== pi && w.v === 1 && !w.cut), H.wires.find(w => w.o === pi && w.v === 1 && !w.cut)); }
  assert.equal(H.pending, null); assert.equal(H.officialState.blind.value, 2); assert.equal(H.turnNo, 3);
});

test('单拆四根同样领奖；暂停、保存与过期选择保留状态；旧改编第15关不启用模块', () => {
  const G = rig(); G.wires.filter(w => w.v === 1).forEach(w => { w.o = 0; }); G.players.forEach((p, pi) => { p.stands = [G.wires.filter(w => w.o === pi).sort((a, b) => a.v - b.v).map(w => w.id)]; });
  act(G, 0, { a: 'solo', val: 1 }); assert.equal(G.pending.type, 'equipment-reveal');
  const saved = JSON.parse(JSON.stringify(G)), id = saved.pending.id;
  assert.equal(BB.setPaused(saved, true), null); rejected(saved, 1, { a: 'equipment-reveal', id, slot: 'back-1' });
  assert.equal(BB.setPaused(saved, false), null); act(saved, 1, { a: 'equipment-reveal', id, slot: 'back-1' });
  assert(BB.equipUnlocked(saved, 4)); assert.equal(saved.equip[0].hidden, true); assert(!saved.pending);
  const restored = BB.unpack(BB.packPublic(saved), BB.packHand(saved, 0), 0, BB.packChoice(saved, 0)); assert.equal(restored.equip[1].n, 4); assert(!('n' in restored.equip[0]));
  const legacy = BB.createGame(M.get('custom', 15), seats(3), { rng: rng() }); assert(!legacy.officialState); assert(legacy.equip.every(e => !e.hidden));
});

test('第15关100局全信息通关与64局推理机器人合法结束', () => {
  let count = 0;
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 25; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && G.phase !== 'won'; k++) {
      const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; let a;
      if (G.pending?.type === 'cut') {
        const pd = G.pending; a = { a: 'resolve', id: pd.id, w: pd.step === 'own' ? BB.view(G, pi).pending.choices.at(-1) : pd.ids.find(id => pd.vals.some(v => BB.matches(G.wires[id].v, v))) };
      } else if (G.pending || G.phase === 'setup') a = Bot.decide(G, pi);
      else {
        const own = G.wires.filter(w => w.o === pi && !w.cut);
        if (own.every(w => BB.kindOf(w.v) === 'r')) a = { a: 'red' };
        else { const value = own.find(w => Number.isInteger(w.v)).v; a = BB.soloOk(G, pi, value) ? { a: 'solo', val: value } : { a: 'dual', val: value, w: G.wires.find(w => w.o !== pi && !w.cut && w.v === value).id }; }
      }
      assert(a); act(G, pi, a); count++;
    }
    assert.equal(G.phase, 'won'); assert.equal(G.det, 0);
  }
  for (let n = 2; n <= 5; n++) for (let seed = 1; seed <= 16; seed++) {
    const G = game(n, seed, seed % n);
    for (let k = 0; k < 1000 && !['won', 'lost'].includes(G.phase); k++) { const pi = G.pending ? G.pending.to : G.phase === 'setup' ? BB.setupActor(G) : G.turn; const a = Bot.decide(G, pi); assert(a); act(G, pi, a); }
    assert(['won', 'lost'].includes(G.phase));
  }
  console.log('  100局全信息通关，共 ' + count + ' 个合法动作；另64局机器人均合法结束。');
});

test('第15关权威服务端2–5人：所有视角隐藏装备身份、队伍选择、重连重启与去重', () => {
  const fs = require('fs'), os = require('os'), path = require('path'), Service = require('../server/official');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb15-authority-')), wss = { clients: new Set() }, service = Service(wss, dir);
  const last = (ws, topic) => ws.messages.filter(m => m.topic === topic).at(-1)?.data;
  function peer(name) { const ws = { room: name, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } }; wss.clients.add(ws); return ws; }
  try {
    for (let n = 2; n <= 5; n++) {
      const name = 'bb-blind' + n, peers = Array.from({ length: n }, () => peer(name));
      peers.forEach((ws, pi) => service.handle(ws, pi ? 'hello' : 'official:hello', { ruleset: 'campaign', mid: 15, name: '玩家' + pi }));
      const room = service.load(name); service.handle(peers[0], 'official:start', { mid: 15, revision: room.revision, commandId: '开始' });
      room.G = rig(n); room.G.players.forEach((p, pi) => { p.pid = room.seats[pi].pid; });
      function send(pi, commandId, a, svc = service, state = room, ws = peers[pi]) { svc.handle(ws, 'official:act', { gid: state.G.gid, revision: state.revision, commandId, action: a }); }
      for (let pair = 0; pair < 2; pair++) {
        const pi = room.G.turn, own = room.G.wires.filter(w => w.o === pi && w.v === 1 && !w.cut).at(-1), target = room.G.wires.find(w => w.o !== pi && w.v === 1 && !w.cut);
        send(pi, '拆线' + pair, { a: 'dual', w: target.id, val: 1 });
        send(target.o, '回应' + pair, { a: 'resolve', id: room.G.pending.id, w: target.id });
        send(pi, '自身' + pair, { a: 'resolve', id: room.G.pending.id, w: own.id });
      }
      const pd = room.G.pending; assert.equal(pd.type, 'equipment-reveal');
      const spectator = peer(name); service.handle(spectator, 'hello', { name: '观战', spectator: true });
      service.handle(spectator, 'official:perspective', { pid: room.seats[0].pid });
      for (const ws of peers.concat(spectator)) {
        const V = last(ws, 'official:view').view; assert(V.equip.every(e => e.hidden && !('n' in e) && !('id' in e)));
        assert(!JSON.stringify(V).includes('"equipmentReserve"')); assert(!JSON.stringify(V).includes('"deck"'));
        assert.equal(V.pending.id, pd.id); assert.equal(V.pending.slots.length, n);
      }
      const before = JSON.stringify(room.G); send(0, '观战冒用', { a: 'equipment-reveal', id: pd.id, slot: 'back-0' }, service, room, spectator); assert.equal(JSON.stringify(room.G), before);
      const credential = last(peers[0], 'official:welcome').credential, reconnected = peer(name); service.handle(reconnected, 'hello', { credential, name: '玩家0' }); assert.equal(last(reconnected, 'official:view').view.pending.id, pd.id);
      const restoredWss = { clients: new Set(peers.concat(spectator)) }, svc = Service(restoredWss, dir), state = svc.load(name);
      assert.equal(state.G.pending.id, pd.id); assert(state.G.equip.every(e => e.hidden));
      send(0, '过期翻牌', { a: 'equipment-reveal', id: pd.id - 1, slot: 'back-0' }, svc, state); assert.equal(JSON.stringify(state.G), before);
      send(0, '翻牌', { a: 'equipment-reveal', id: pd.id, slot: 'back-0' }, svc, state);
      assert(!state.G.equip[0].hidden); assert(state.G.equip.slice(1).every(e => e.hidden));
      const revision = state.revision; send(0, '翻牌', { a: 'equipment-reveal', id: pd.id, slot: 'back-0' }, svc, state); assert.equal(state.revision, revision);
      send(1, '新编号重复翻牌', { a: 'equipment-reveal', id: pd.id, slot: 'back-1' }, svc, state); assert.equal(state.revision, revision);
      const again = Service(restoredWss, dir), loaded = again.load(name); send(0, '翻牌', { a: 'equipment-reveal', id: pd.id, slot: 'back-0' }, again, loaded); assert.equal(loaded.revision, revision);
      const V = last(peers[0], 'official:view').view; assert.equal(V.equip[0].n, 6); assert(V.equip.slice(1).every(e => !('n' in e)));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
